/**
 * 节点上下文：methods 中通过 ctx.$self / $parent / $siblings / $children 访问节点关系
 *
 * 使用 Proxy + WeakMap 实现 ctx.$parent.$parent 链式访问，不污染用户 schema。
 */

import type { SchemaNode } from '@variojs/schema'

/** 节点在树中的上下文（父、兄弟、自身索引等） */
export interface NodeContext {
  /** 父节点 schema */
  parent?: SchemaNode
  /** 同层兄弟节点数组（含自身，与 parent.children 顺序一致） */
  siblings?: SchemaNode[]
  /** 当前节点在 siblings 中的下标 */
  selfIndex?: number
  /** 节点路径（可选，供 path-memo / patchNode 等使用） */
  path?: string
}

/** 渲染过程中维护的 节点 → 父节点 映射 */
export type ParentMap = WeakMap<SchemaNode, SchemaNode | null>

const PARENT_KEYS = ['parent', '$parent'] as const

/**
 * 为 schema 节点创建 Proxy，使访问 .parent / .$parent 时从 parentMap 解析并支持链式访问。
 * 其余属性直接转发到真实节点，读写 schema 仍作用在真实对象上。
 */
export function createNodeProxy(
  node: SchemaNode | null | undefined,
  parentMap: ParentMap
): SchemaNode | null {
  if (node == null) {
    return null
  }
  return new Proxy(node, {
    get(target, prop: string) {
      if (PARENT_KEYS.includes(prop as typeof PARENT_KEYS[number])) {
        const p = parentMap.get(target)
        return p === undefined ? undefined : createNodeProxy(p ?? undefined, parentMap)
      }
      return (target as Record<string, unknown>)[prop]
    },
    set(target, prop: string, value: unknown) {
      if (PARENT_KEYS.includes(prop as typeof PARENT_KEYS[number])) {
        return false
      }
      ;(target as Record<string, unknown>)[prop] = value
      return true
    }
  }) as SchemaNode
}

/**
 * 将节点上下文挂到 ctx，供事件/actions 执行时使用。
 * 执行前调用，执行后可由调用方选择是否清除。
 */
export function applyNodeContextToCtx(
  ctx: Record<string, unknown>,
  schema: SchemaNode,
  nodeContext: NodeContext | undefined,
  parentMap: ParentMap
): void {
  ctx.$self = createNodeProxy(schema, parentMap)
  if (nodeContext?.parent != null) {
    ctx.$parent = createNodeProxy(nodeContext.parent, parentMap)
  } else {
    ctx.$parent = null
  }
  const siblings = nodeContext?.siblings ?? []
  const selfIndex = nodeContext?.selfIndex ?? -1
  ctx.$siblings = siblings
    .filter((_, i) => i !== selfIndex)
    .map(s => createNodeProxy(s, parentMap))
  ctx.$children = Array.isArray(schema.children) ? schema.children : undefined
}
