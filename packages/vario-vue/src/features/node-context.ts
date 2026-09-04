/**
 * 节点上下文：methods 中通过 ctx.$self / $parent / $siblings / $children 访问节点关系
 *
 * 使用 Proxy + WeakMap 实现 ctx.$parent.$parent 链式访问，不污染用户 schema。
 */

import type { SchemaNode } from '@variojs/schema'
import type { PreparedView } from '@variojs/types'

/** 节点在树中的上下文（父、兄弟、自身索引等） */
export interface NodeContext {
  /** 父节点 schema */
  parent?: SchemaNode
  /** 同层兄弟节点数组（含自身，与 parent.children 顺序一致） */
  siblings?: SchemaNode[]
  /** 当前节点在 siblings 中的下标 */
  selfIndex?: number
  /** 节点路径（可选，供节点追踪使用） */
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
 *
 * 优化：parent/siblings/selfIndex 全部从 parentMap 实时查找，
 * 不依赖 nodeContext 闭包捕获。这样事件处理器函数可以安全缓存
 * （同一 schema 引用 → 同一处理器函数引用），避免 Vue 因函数引用变化
 * 而不必要地重渲染组件。
 */
export function applyNodeContextToCtx(
  ctx: Record<string, unknown>,
  schema: SchemaNode,
  parentMap: ParentMap
): void {
  ctx.$self = createNodeProxy(schema, parentMap)
  const parent = parentMap.get(schema) ?? null
  if (parent != null) {
    ctx.$parent = createNodeProxy(parent, parentMap)
    const siblings = Array.isArray(parent.children) ? parent.children as SchemaNode[] : []
    const selfIndex = siblings.indexOf(schema)
    ctx.$siblings = siblings
      .filter((_, i) => i !== selfIndex)
      .map(s => createNodeProxy(s, parentMap))
  } else {
    ctx.$parent = null
    ctx.$siblings = []
  }
  ctx.$children = Array.isArray(schema.children) ? schema.children : undefined
}

function siblingIdsOf(view: PreparedView, nodeId: string): readonly string[] {
  const node = view.nodes.get(nodeId)
  const parentId = node?.parentId
  if (!parentId) return []
  return (view.nodes.get(parentId)?.childIds ?? []).filter(id => id !== nodeId)
}

function createSiblingList(
  childIds: readonly string[],
  sources: ReadonlyMap<string, SchemaNode> | undefined,
  parentMap: ParentMap
): SchemaNode[] {
  return new Proxy([] as SchemaNode[], {
    get(_target, prop) {
      if (prop === 'length') return childIds.length
      if (prop === Symbol.iterator) {
        return function* () {
          for (const id of childIds) {
            const live = sources?.get(id)
            if (live) yield createNodeProxy(live, parentMap)!
          }
        }
      }
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const live = sources?.get(childIds[Number(prop)])
        return live ? createNodeProxy(live, parentMap) : undefined
      }
      const value = (Array.prototype as unknown as Record<PropertyKey, unknown>)[prop as string]
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const materialized = childIds
            .map(id => sources?.get(id))
            .filter((live): live is SchemaNode => !!live)
            .map(live => createNodeProxy(live, parentMap)!)
          return (value as (...xs: unknown[]) => unknown).apply(materialized, args)
        }
      }
      return undefined
    }
  })
}

export function applyPreparedNodeContext(
  ctx: Record<string, unknown>,
  schema: SchemaNode,
  view: PreparedView,
  nodeId: string,
  sources: ReadonlyMap<string, SchemaNode> | undefined,
  parentMap: ParentMap,
  loopCells?: ReadonlyMap<string, readonly { readonly key: string | number; readonly index: number }[]>
): void {
  ctx.$self = createNodeProxy(schema, parentMap)
  const parentId = view.nodes.get(nodeId)?.parentId
  if (parentId) {
    const parentLive = sources?.get(parentId)
    ctx.$parent = parentLive ? createNodeProxy(parentLive, parentMap) : null
    const parentLoop = view.loops.get(parentId)
    if (parentLoop) {
      const cells = loopCells?.get(parentId) ?? []
      const selfIndex = Number(ctx.$index ?? ctx[parentLoop.indexKey] ?? ctx[parentLoop.indexAlias ?? ''] ?? -1)
      ctx.$siblings = createCellSiblingList(cells, selfIndex)
    } else {
      ctx.$siblings = createSiblingList(siblingIdsOf(view, nodeId), sources, parentMap)
    }
  } else {
    ctx.$parent = null
    ctx.$siblings = createSiblingList([], sources, parentMap)
  }
  const childIds = view.nodes.get(nodeId)?.childIds ?? []
  ctx.$children = childIds.length
    ? createSiblingList(childIds, sources, parentMap)
    : (Array.isArray(schema.children) ? schema.children : undefined)
}

function createCellSiblingList(
  cells: readonly { readonly key: string | number; readonly index: number }[],
  selfIndex: number
): unknown[] {
  return new Proxy([] as unknown[], {
    get(_target, prop) {
      if (prop === 'length') {
        let n = 0
        for (const cell of cells) if (cell.index !== selfIndex) n++
        return n
      }
      if (prop === Symbol.iterator) {
        return function* () {
          for (const cell of cells) {
            if (cell.index !== selfIndex) yield cell
          }
        }
      }
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const want = Number(prop)
        let seen = 0
        for (const cell of cells) {
          if (cell.index === selfIndex) continue
          if (seen === want) return cell
          seen++
        }
        return undefined
      }
      const value = (Array.prototype as unknown as Record<PropertyKey, unknown>)[prop as string]
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const materialized: unknown[] = []
          for (const cell of cells) {
            if (cell.index !== selfIndex) materialized.push(cell)
          }
          return (value as (...xs: unknown[]) => unknown).apply(materialized, args)
        }
      }
      return undefined
    }
  })
}
