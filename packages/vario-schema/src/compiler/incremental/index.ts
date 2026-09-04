import type { PreparedNode, PreparedView, SchemaNode } from '@variojs/types'
import { prepareView, bindPreparedSources, getPreparedSources } from '../prepare-view.js'
import { traverseIterative } from '../traverse-iterative.js'
import { collectNodeExpressionSources, compileExpressionSources } from '../prepare-expression.js'
import { compileNodeActions } from '../prepare-action.js'
import { compileLoopPlan } from '../prepare-loop.js'
import { compileSlotPlan } from '../prepare-slot.js'

export function collectAffectedIds(view: PreparedView, path: string): string[] {
  return (view.nodeList ?? [...view.nodes.values()])
    .filter(n =>
      n.path === path ||
      n.path.startsWith(path ? `${path}.` : '') ||
      path.startsWith(n.path ? `${n.path}.` : n.path)
    )
    .map(n => n.id)
}

export function reuseUnaffected(
  previous: PreparedView,
  next: PreparedView,
  affected: ReadonlySet<string>
): PreparedView {
  const prevList = previous.nodeList ?? [...previous.nodes.values()]
  const nextList = next.nodeList ?? [...next.nodes.values()]
  const prevById = new Map(prevList.map(n => [n.id, n]))
  const nodes = nextList.map(n => (affected.has(n.id) ? n : (prevById.get(n.id) ?? n)))
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const view = Object.freeze({
    ...next,
    nodes: nodeMap,
    nodeList: Object.freeze(nodes),
    nodeMap
  })
  const sources = new Map(getPreparedSources(previous) ?? [])
  const nextSources = getPreparedSources(next)
  if (nextSources) {
    for (const id of affected) {
      const live = nextSources.get(id)
      if (live) sources.set(id, live)
    }
  }
  bindPreparedSources(view, sources)
  return view
}

function liveChildCount(schema: SchemaNode): number {
  if (Array.isArray(schema.children)) return schema.children.length
  if (schema.children && typeof schema.children === 'object') return 1
  return 0
}

function findLiveNode(root: SchemaNode, target: PreparedNode): SchemaNode {
  if ((root as { id?: string }).id === target.id) return root
  let found: SchemaNode | null = null
  traverseIterative(root, ({ node, path }) => {
    const id = (node as { id?: string }).id
    if ((typeof id === 'string' && id === target.id) || path === target.path) {
      found = node
      return false
    }
    return undefined
  })
  if (found) return found
  throw new Error(`Cannot locate live node ${target.id}`)
}

function recompileSingleNode(
  previous: PreparedView,
  node: PreparedNode,
  live: SchemaNode,
  revision: number
): PreparedView {
  const expressions = new Map(previous.expressions)
  const actions = new Map(previous.actions)
  const loops = new Map(previous.loops)
  const slots = new Map(previous.slots)
  for (const id of node.expressionIds ?? []) expressions.delete(id)
  actions.delete(node.id)
  loops.delete(node.id)
  slots.delete(node.id)

  const expressionIds = compileExpressionSources(collectNodeExpressionSources(live), expressions)
  const compiledActions = compileNodeActions(live)
  if (Object.keys(compiledActions).length > 0) actions.set(node.id, compiledActions)
  const loopPlan = compileLoopPlan(live, node.id, node.childIds)
  if (loopPlan) loops.set(node.id, loopPlan)
  const slotPlan = compileSlotPlan(live, node.id, node.childIds)
  if (slotPlan) slots.set(node.id, slotPlan)

  const updated = Object.freeze({
    ...node,
    expressionIds: Object.freeze(expressionIds),
    dynamicPlans: Object.freeze(expressionIds),
    loopPlanId: loopPlan?.nodeId,
    slotPlanId: slotPlan?.nodeId
  })
  const prevList = previous.nodeList ?? [...previous.nodes.values()]
  const nodes = prevList.map(n => (n.id === node.id ? updated : n))
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const view = Object.freeze({
    ...previous,
    revision,
    nodes: nodeMap,
    nodeList: Object.freeze(nodes),
    nodeMap,
    expressions,
    actions,
    loops,
    slots
  })
  const sources = new Map(getPreparedSources(previous) ?? [])
  sources.set(node.id, live)
  bindPreparedSources(view, sources)
  return view
}

export function recompileIncremental(
  root: SchemaNode,
  previous: PreparedView,
  path: string,
  revision: number
): { view: PreparedView; affectedIds: string[] } {
  const prevList = previous.nodeList ?? [...previous.nodes.values()]
  const target = prevList.find(n => n.path === path || n.id === path)
  if (target) {
    const live = findLiveNode(root, target)
    if (liveChildCount(live) === target.childIds.length) {
      return {
        view: recompileSingleNode(previous, target, live, revision),
        affectedIds: [target.id]
      }
    }
  }
  const next = prepareView(root, { revision })
  const affectedIds = collectAffectedIds(next, path)
  return {
    view: reuseUnaffected(previous, next, new Set(affectedIds)),
    affectedIds
  }
}
