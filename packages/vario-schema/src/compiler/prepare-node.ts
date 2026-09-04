import type { PreparedNode, PreparedRegion, RegionKind, SchemaNode } from '@variojs/types'

function hasNamedSlotChild(node: SchemaNode): boolean {
  const children = node.children
  if (!Array.isArray(children)) return false
  return children.some(child =>
    !!child &&
    typeof child === 'object' &&
    (child as { type?: string }).type === 'template' &&
    (child as { slot?: unknown }).slot
  )
}

function isCustomComponentType(type: string): boolean {
  const code = type.charCodeAt(0)
  return type.includes('-') || (code >= 65 && code <= 90)
}

export function classifyRegion(node: SchemaNode): RegionKind {
  if (node.loop) return 'loop'
  if (node.type === 'template' || (node as { slot?: unknown }).slot) return 'slot'
  const rec = node as Record<string, unknown>
  if (
    rec.onMounted ||
    rec.onUnmounted ||
    rec.onUpdated ||
    rec.onBeforeMount ||
    rec.onBeforeUnmount ||
    rec.onBeforeUpdate ||
    rec.onActivated ||
    rec.onDeactivated ||
    rec.teleport ||
    rec.transition ||
    rec.keepAlive
  ) {
    return 'semantic'
  }
  if (rec.ref || rec.directives || rec.cond || rec.show || rec.events || rec.model || rec.provide || rec.inject) {
    return 'semantic'
  }
  if (hasNamedSlotChild(node) || isCustomComponentType(node.type)) return 'semantic'
  const props = node.props
  if (props && JSON.stringify(props).includes('{{')) return 'dynamic'
  if (typeof node.children === 'string' && node.children.includes('{{')) return 'dynamic'
  return 'static'
}

export function applyRegionClassification(
  nodes: PreparedNode[],
  sources?: ReadonlyMap<string, SchemaNode>
): PreparedNode[] {
  return nodes.map(n => {
    const live = sources?.get(n.id) ?? n.schema
    if (!live) return Object.freeze({ ...n })
    const next: PreparedNode = { ...n, region: classifyRegion(live) }
    const { schema: _omit, ...rest } = next
    return Object.freeze(rest)
  })
}

export function groupMaximalRegions(nodes: readonly PreparedNode[]): PreparedRegion[] {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const staticRoots: string[] = []
  const others: Record<Exclude<RegionKind, 'static'>, string[]> = {
    dynamic: [],
    loop: [],
    slot: [],
    semantic: []
  }

  for (const node of nodes) {
    if (node.region !== 'static') {
      others[node.region].push(node.id)
      continue
    }
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (!parent || parent.region !== 'static') {
      staticRoots.push(node.id)
    }
  }

  return [
    { id: 'static:0', kind: 'static', nodeIds: Object.freeze(staticRoots) },
    { id: 'dynamic:0', kind: 'dynamic', nodeIds: Object.freeze(others.dynamic) },
    { id: 'loop:0', kind: 'loop', nodeIds: Object.freeze(others.loop) },
    { id: 'slot:0', kind: 'slot', nodeIds: Object.freeze(others.slot) },
    { id: 'semantic:0', kind: 'semantic', nodeIds: Object.freeze(others.semantic) }
  ]
}
