import type { LoopPlan, SchemaNode } from '@variojs/types'
import { compileExpressionPlan } from '@variojs/core'

export function loopRequiresLegacy(node: SchemaNode): boolean {
  if (!node.loop) return false
  const items = (node.loop as { items?: unknown }).items
  if (typeof items === 'function') return true
  const key = (node.loop as { key?: unknown }).key
  return key != null && typeof key === 'object'
}

export function compileLoopPlan(
  node: SchemaNode,
  nodeId: string,
  templateIds: readonly string[],
  ancestorAliases: readonly string[] = []
): LoopPlan | null {
  if (!node.loop) return null
  const items = node.loop.items
  const itemsSource = typeof items === 'string'
    ? items.replace(/^\{\{|\}\}$/g, '').trim()
    : typeof items === 'function'
      ? ''
      : JSON.stringify(items) ?? ''
  const rawKey = node.loop.key ?? null
  const keySource = typeof rawKey === 'string'
    ? rawKey.replace(/^\{\{|\}\}$/g, '').trim() || null
    : null
  const itemKey = node.loop.itemKey ?? 'item'
  const indexKey = node.loop.indexKey ?? 'index'
  const template = { ...node } as SchemaNode
  delete (template as { loop?: unknown }).loop
  // items/key 表达式本身不含自身别名，只用祖先别名编译（T3.2）
  const aliasOption = ancestorAliases.length > 0 ? { aliases: ancestorAliases } : undefined
  return Object.freeze({
    nodeId,
    itemsSource,
    itemKey,
    indexKey,
    keySource,
    templateIds: Object.freeze([...templateIds]),
    template: Object.freeze(template),
    regionId: nodeId,
    itemsPlanId: itemsSource ? compileExpressionPlan(itemsSource, aliasOption).id : undefined,
    templateNodeId: templateIds[0] ?? nodeId,
    itemAlias: itemKey,
    indexAlias: indexKey,
    keyPlanId: keySource ? compileExpressionPlan(keySource, aliasOption).id : undefined,
    estimatedTemplateNodes: templateIds.length,
    virtual: node.loop.virtual
  })
}
