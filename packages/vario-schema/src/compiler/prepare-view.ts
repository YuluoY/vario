import type { Action, ExpressionPlan, LoopPlan, PreparedNode, PreparedView, SlotPlan, VarioDiagnostic, MaterialManifest } from '@variojs/types'
import type { SchemaNode } from '@variojs/types'
import { ErrorCodes, VarioError, type DiagnosticSink, compileExpressionPlan } from '@variojs/core'
import { buildPrepareIndex } from './prepare-index.js'
import { applyRegionClassification, groupMaximalRegions } from './prepare-node.js'
import { compileLoopPlan, loopRequiresLegacy } from './prepare-loop.js'
import { compileSlotPlan, slotRequiresLegacy } from './prepare-slot.js'
import { assertSupportedModifiers } from './event-modifiers.js'
import { collectNodeExpressionSources, compileExpressionSources } from './prepare-expression.js'
import { compileNodeActions } from './prepare-action.js'

export type PrepareViewOptions = {
  maxDepth?: number
  maxNodes?: number
  revision?: number
  materials?: ReadonlyMap<string, MaterialManifest>
  materialMode?: 'legacy' | 'strict' | 'untrusted'
  diagnosticSink?: DiagnosticSink
}

const preparedViewCache = new WeakMap<SchemaNode, { revision: number; maxDepth?: number; maxNodes?: number; materialMode?: string; view: PreparedView }>()
const preparedSources = new WeakMap<PreparedView, Map<string, SchemaNode>>()

const FLAG_DYNAMIC = 1
const FLAG_LOOP = 2
const FLAG_EVENTS = 4
const FLAG_MODEL = 8
const FLAG_COND = 16
const FLAG_SHOW = 32
const FLAG_SLOT = 64

export function getPreparedSources(view: PreparedView): ReadonlyMap<string, SchemaNode> | undefined {
  return preparedSources.get(view)
}

export function bindPreparedSources(view: PreparedView, sources: Map<string, SchemaNode>): void {
  preparedSources.set(view, sources)
}

export function listPreparedNodes(view: PreparedView): readonly PreparedNode[] {
  return view.nodeList ?? [...view.nodes.values()]
}

function isCustomMaterialType(type: string): boolean {
  const first = type.charAt(0)
  return first !== '' && first !== first.toLowerCase()
}

function materialKnown(materials: ReadonlyMap<string, MaterialManifest>, type: string): boolean {
  if (materials.has(type)) return true
  for (const manifest of materials.values()) {
    if (manifest.type === type || manifest.name === type) return true
  }
  return false
}

function nodeFlags(schema: SchemaNode, expressionIds: readonly string[]): number {
  let flags = 0
  if (expressionIds.length) flags |= FLAG_DYNAMIC
  if (schema.loop) flags |= FLAG_LOOP
  if (schema.events) flags |= FLAG_EVENTS
  if (schema.model) flags |= FLAG_MODEL
  if (schema.cond) flags |= FLAG_COND
  if (schema.show) flags |= FLAG_SHOW
  if (schema.type === 'template' || (schema as { slot?: unknown }).slot) flags |= FLAG_SLOT
  return flags
}

function staticAttrsFrom(schema: SchemaNode): Readonly<Record<string, unknown>> | undefined {
  const props = schema.props
  if (!props) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' && value.includes('{{')) continue
    out[key] = value
  }
  return Object.keys(out).length ? Object.freeze(out) : undefined
}

function isSingleExpressionSource(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed.includes('{{')) return true
  if (!trimmed.startsWith('{{') || !trimmed.endsWith('}}')) return false
  const inner = trimmed.slice(2, -2)
  return !inner.includes('{{') && !inner.includes('}}')
}

function planIdFrom(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  if (!isSingleExpressionSource(raw)) return undefined
  const trimmed = raw.trim()
  const source = trimmed.startsWith('{{') ? trimmed.slice(2, -2).trim() : trimmed
  if (!source) return undefined
  return compileExpressionPlan(source).id
}

function dynamicPropsFrom(schema: SchemaNode): Readonly<Record<string, string>> | undefined {
  const props = schema.props
  if (!props) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' && value.includes('{{')) {
      const id = planIdFrom(value)
      if (id) out[key] = id
    }
  }
  return Object.keys(out).length ? Object.freeze(out) : undefined
}

function textPlanFrom(schema: SchemaNode): { readonly planId: string } | undefined {
  if (typeof schema.children !== 'string' || !schema.children.includes('{{')) return undefined
  const id = planIdFrom(schema.children)
  return id ? Object.freeze({ planId: id }) : undefined
}

function modelPlansFrom(schema: SchemaNode): readonly { readonly path: string }[] | undefined {
  const model = schema.model
  if (!model) return undefined
  const path = typeof model === 'string' ? model : (model as { path?: string }).path
  if (!path) return undefined
  return Object.freeze([{ path }])
}

export function prepareView(root: SchemaNode, options: PrepareViewOptions = {}): PreparedView {
  const revision = options.revision ?? 1
  if (options.revision != null) {
    const cached = preparedViewCache.get(root)
    if (
      cached &&
      cached.revision === revision &&
      cached.maxDepth === options.maxDepth &&
      cached.maxNodes === options.maxNodes
    ) {
      return cached.view
    }
  }

  const diagnostics: VarioDiagnostic[] = []
  const index = buildPrepareIndex(root, { maxDepth: options.maxDepth, maxNodes: options.maxNodes })
  const classified = applyRegionClassification(index.nodes, index.sourceById)

  const expressions = new Map<string, ExpressionPlan>()
  const actions = new Map<string, Readonly<Record<string, readonly Action[]>>>()
  const loops = new Map<string, LoopPlan>()
  const slots = new Map<string, SlotPlan>()
  // 祖先 loop 别名传递（T3.2）：节点按 DFS 先序遍历，父节点先于子节点；
  // loop 节点的模板后代表达式编译时注入 itemKey/indexKey 作为 localDeps
  const aliasesByNode = new Map<string, readonly string[]>()

  const nodes: PreparedNode[] = classified.map(n => {
    const live = index.sourceById.get(n.id)
    if (!live) {
      throw new VarioError(`Missing source for ${n.id}`, ErrorCodes.SCHEMA_VALIDATION_ERROR, { schemaPath: n.path })
    }
    const childIds = Object.freeze(index.childIdBuf.get(live) ?? [])
    const inheritedAliases = n.parentId ? aliasesByNode.get(n.parentId) ?? [] : []
    const events = (live as { events?: Record<string, unknown> }).events
    if (events) {
      for (const key of Object.keys(events)) {
        assertSupportedModifiers(key, n.path)
        if (typeof events[key] === 'function') {
          diagnostics.push({
            code: 'LEGACY_REQUIRED',
            message: 'unsupported event feature requires legacy runtime for the whole page',
            path: n.path,
            phase: 'prepare',
            nodeId: n.id
          })
        }
      }
    }

    // loop 节点：items/key 表达式用祖先别名编译；模板后代表达式用含自身别名的集合
    const loopPlan = compileLoopPlan(live, n.id, childIds, inheritedAliases)
    const effectiveAliases = loopPlan
      ? [...inheritedAliases, loopPlan.itemKey, loopPlan.indexKey]
      : inheritedAliases
    aliasesByNode.set(n.id, effectiveAliases)

    // items 表达式排除在节点通用编译之外（它只用祖先别名，见下方 loopPlan 分支）
    const rawLoopItems = live.loop && typeof live.loop.items === 'string' ? live.loop.items : null
    const loopItemsSource = rawLoopItems
      ? (rawLoopItems.startsWith('{{') ? rawLoopItems.replace(/^\{\{|\}\}$/g, '').trim() : rawLoopItems)
      : null
    const nodeSources = collectNodeExpressionSources(live).filter(s => s !== loopItemsSource)

    const expressionIds = compileExpressionSources(nodeSources, expressions, effectiveAliases)
    const compiledActions = compileNodeActions(live)
    if (Object.keys(compiledActions).length > 0) actions.set(n.id, compiledActions)

    if (loopPlan) {
      loops.set(n.id, loopPlan)
      if (loopRequiresLegacy(live)) {
        diagnostics.push({
          code: 'LEGACY_REQUIRED',
          message: 'unsupported loop feature requires legacy runtime for the whole page',
          path: n.path,
          phase: 'prepare',
          nodeId: n.id
        })
      }
      if (loopPlan.itemsPlanId && !expressions.has(loopPlan.itemsPlanId)) {
        expressions.set(
          loopPlan.itemsPlanId,
          compileExpressionPlan(
            loopPlan.itemsSource,
            inheritedAliases.length > 0 ? { aliases: inheritedAliases } : undefined
          )
        )
      }
      if (loopPlan.keyPlanId && !expressions.has(loopPlan.keyPlanId) && loopPlan.keySource) {
        expressions.set(
          loopPlan.keyPlanId,
          compileExpressionPlan(
            loopPlan.keySource,
            inheritedAliases.length > 0 ? { aliases: inheritedAliases } : undefined
          )
        )
      }
      if (loopPlan.keySource == null) {
        diagnostics.push({
          code: 'LOOP_INDEX_KEY_FALLBACK',
          message: 'loop has no key; falling back to index',
          path: n.path,
          phase: 'prepare'
        })
      }
      const loopItems = (live.loop as { items?: unknown }).items
      if (Array.isArray(loopItems) && loopItems.length >= 100) {
        diagnostics.push({
          code: 'LOOP_LARGE_LIST',
          message: 'loop has 100+ items; host virtual adapter recommended',
          path: n.path,
          phase: 'prepare',
          nodeId: n.id,
          metadata: { count: loopItems.length }
        })
      }
    }
    const slotPlan = compileSlotPlan(live, n.id, childIds)
    if (slotPlan) slots.set(n.id, slotPlan)
    if (slotRequiresLegacy(live)) {
      diagnostics.push({
        code: 'LEGACY_REQUIRED',
        message: 'unsupported slot feature requires legacy runtime for the whole page',
        path: n.path,
        phase: 'prepare',
        nodeId: n.id
      })
    }

    if ((options.materials != null || options.materialMode) && isCustomMaterialType(n.type)) {
      if (!materialKnown(options.materials ?? new Map(), n.type)) {
        const diagnostic: VarioDiagnostic = {
          code: 'UNKNOWN_MATERIAL',
          message: `Unknown material "${n.type}"; falling back to string tag`,
          path: n.path,
          phase: 'prepare'
        }
        options.diagnosticSink?.emit({
          name: 'material-error',
          nodeId: n.id,
          diagnostic
        })
        if (options.materialMode === 'strict' || options.materialMode === 'untrusted') {
          throw new VarioError(diagnostic.message, ErrorCodes.SCHEMA_VALIDATION_ERROR, { schemaPath: n.path })
        }
        diagnostics.push(diagnostic)
      } else {
        options.diagnosticSink?.emit({ name: 'material-resolve', nodeId: n.id })
      }
    }

    const { schema: _omit, ...rest } = n
    const attrs = staticAttrsFrom(live)
    const flags = nodeFlags(live, expressionIds)
    return Object.freeze({
      ...rest,
      componentType: n.type,
      schemaPath: n.path,
      childIds,
      childrenIds: childIds,
      regionId: n.id,
      expressionIds: Object.freeze(expressionIds),
      dynamicPlans: Object.freeze(expressionIds),
      dynamicProps: dynamicPropsFrom(live),
      textPlan: textPlanFrom(live),
      conditionPlan: planIdFrom(live.cond),
      showPlan: planIdFrom(live.show),
      eventPlans: Object.keys(compiledActions).length ? compiledActions : undefined,
      modelPlans: modelPlansFrom(live),
      staticAttrs: attrs,
      staticProps: attrs,
      flags,
      featureFlags: flags,
      loopPlanId: loopPlan?.nodeId,
      slotPlanId: slotPlan?.nodeId
    })
  })

  const regions = groupMaximalRegions(nodes)
  const regionList = Object.freeze(regions)
  const regionMap = new Map(regions.map(r => [r.id ?? r.kind, r]))

  if (index.writes > 3 * index.nodeCount) {
    diagnostics.push({
      code: 'INDEX_WRITE_BUDGET',
      message: `index writes ${index.writes} exceed 3N=${3 * index.nodeCount}`,
      path: '',
      phase: 'prepare'
    })
  }

  const rootNodeId = nodes[0]?.id ?? 'node:root'
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const view = Object.freeze({
    id: `view:${rootNodeId}:${revision}`,
    revision,
    rootNodeId,
    rootId: rootNodeId,
    nodes: nodeMap,
    nodeList: Object.freeze(nodes),
    nodeMap,
    regions: regionMap,
    regionList,
    regionMap,
    idMap: index.idMap,
    diagnostics: Object.freeze(diagnostics),
    expressions,
    actions,
    loops,
    slots,
    nodeCount: index.nodeCount,
    maxDepth: index.maxDepth,
    stats: Object.freeze({
      nodeCount: index.nodeCount,
      maxDepth: index.maxDepth,
      expressionCount: expressions.size,
      loopCount: loops.size
    }),
    legacyRequired: diagnostics.some(d => d.code === 'LEGACY_REQUIRED')
  })
  bindPreparedSources(view, index.sourceById)
  if (options.revision != null) {
    preparedViewCache.set(root, {
      revision,
      maxDepth: options.maxDepth,
      maxNodes: options.maxNodes,
      view
    })
  }
  return view
}
