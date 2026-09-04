import type { SchemaNode, SlotPlan } from '@variojs/types'

export function slotRequiresLegacy(node: SchemaNode): boolean {
  return typeof (node as { slot?: unknown }).slot === 'function'
}

export function compileSlotPlan(node: SchemaNode, nodeId: string, fallbackIds: readonly string[]): SlotPlan | null {
  const slot = (node as { slot?: string | { name?: string; props?: readonly string[] } }).slot
  if (node.type !== 'template' && slot == null) return null
  const name = typeof slot === 'string' ? slot : slot?.name ?? 'default'
  const propNames = typeof slot === 'object' && slot != null && Array.isArray(slot.props) ? [...slot.props] : []
  return Object.freeze({
    nodeId,
    name,
    propNames: Object.freeze(propNames),
    fallbackIds: Object.freeze([...fallbackIds])
  })
}
