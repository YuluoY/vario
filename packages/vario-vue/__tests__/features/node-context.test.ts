/**
 * 节点上下文（node-context）单元测试
 *
 * 测试 createNodeProxy、applyNodeContextToCtx、ParentMap 链式 .parent 及 ctx.$self/$parent/$siblings/$children
 */

import { describe, it, expect } from 'vitest'
import {
  createNodeProxy,
  applyNodeContextToCtx,
  type NodeContext,
  type ParentMap
} from '../../src/features/node-context.js'
import type { SchemaNode } from '@variojs/schema'

function node(type: string, children?: SchemaNode[]): SchemaNode {
  const n: SchemaNode = { type }
  if (children !== undefined) n.children = children
  return n
}

describe('createNodeProxy', () => {
  it('node 为 null 或 undefined 时返回 null', () => {
    const map: ParentMap = new WeakMap()
    expect(createNodeProxy(null, map)).toBe(null)
    expect(createNodeProxy(undefined, map)).toBe(null)
  })

  it('返回的 proxy 读写普通属性指向真实节点', () => {
    const map: ParentMap = new WeakMap()
    const n = node('div')
    const proxy = createNodeProxy(n, map)!
    expect(proxy.type).toBe('div')
    ;(proxy as Record<string, unknown>).foo = 'bar'
    expect((n as Record<string, unknown>).foo).toBe('bar')
  })

  it('访问 .parent / .$parent 时从 parentMap 解析', () => {
    const map: ParentMap = new WeakMap()
    const root = node('div')
    const child = node('span')
    map.set(child, root)
    const proxy = createNodeProxy(child, map)!
    const parentRef = (proxy as Record<string, unknown>).parent as SchemaNode
    expect(parentRef).toBeDefined()
    expect(parentRef?.type).toBe('div')
    expect((proxy as Record<string, unknown>).$parent).toBeDefined()
    expect(((proxy as Record<string, unknown>).$parent as SchemaNode)?.type).toBe('div')
  })

  it('根节点（parentMap 中父为 null）时 .parent 返回 null', () => {
    const map: ParentMap = new WeakMap()
    const root = node('div')
    map.set(root, null)
    const proxy = createNodeProxy(root, map)!
    expect((proxy as Record<string, unknown>).parent).toBe(null)
    expect((proxy as Record<string, unknown>).$parent).toBe(null)
  })

  it('支持 .parent.parent 链式访问', () => {
    const map: ParentMap = new WeakMap()
    const grand = node('div')
    const parent = node('section')
    const leaf = node('span')
    map.set(leaf, parent)
    map.set(parent, grand)
    map.set(grand, null)
    const proxy = createNodeProxy(leaf, map)!
    const p1 = (proxy as Record<string, unknown>).parent as SchemaNode
    const p2 = (p1 as Record<string, unknown>).parent as SchemaNode
    expect(p1?.type).toBe('section')
    expect(p2?.type).toBe('div')
    expect((p2 as Record<string, unknown>).parent).toBe(null)
  })

  it('设置 .parent / .$parent 无效（返回 false）', () => {
    const map: ParentMap = new WeakMap()
    const n = node('div')
    map.set(n, null)
    const proxy = createNodeProxy(n, map)!
    expect((proxy as Record<string, unknown>).parent).toBe(null)
    const setParent = (p: string, v: unknown) =>
      Reflect.set(proxy as object, p, v)
    expect(setParent('parent', node('span'))).toBe(false)
    expect(setParent('$parent', node('span'))).toBe(false)
    expect((proxy as Record<string, unknown>).parent).toBe(null)
  })
})

describe('applyNodeContextToCtx', () => {
  it('设置 ctx.$self 为当前节点的 proxy', () => {
    const map: ParentMap = new WeakMap()
    const schema = node('button')
    map.set(schema, null)
    const ctx: Record<string, unknown> = {}
    applyNodeContextToCtx(ctx, schema, undefined, map)
    expect(ctx.$self).toBeDefined()
    expect((ctx.$self as SchemaNode).type).toBe('button')
  })

  it('有 parent 时设置 ctx.$parent 为父节点 proxy，否则为 null', () => {
    const map: ParentMap = new WeakMap()
    const parentSchema = node('div')
    const selfSchema = node('button')
    map.set(selfSchema, parentSchema)
    map.set(parentSchema, null)
    const ctx: Record<string, unknown> = {}
    applyNodeContextToCtx(ctx, selfSchema, { parent: parentSchema }, map)
    expect(ctx.$parent).toBeDefined()
    expect((ctx.$parent as SchemaNode).type).toBe('div')
    expect((ctx.$parent as Record<string, unknown>).parent).toBe(null)

    const ctxRoot: Record<string, unknown> = {}
    applyNodeContextToCtx(ctxRoot, parentSchema, undefined, map)
    expect(ctxRoot.$parent).toBe(null)
  })

  it('ctx.$siblings 为除自身外的兄弟节点 proxy 数组', () => {
    const map: ParentMap = new WeakMap()
    const a = node('span')
    const b = node('button')
    const c = node('span')
    const parent = node('div', [a, b, c])
    map.set(a, parent)
    map.set(b, parent)
    map.set(c, parent)
    const ctx: Record<string, unknown> = {}
    applyNodeContextToCtx(ctx, b, {
      parent,
      siblings: [a, b, c],
      selfIndex: 1
    }, map)
    expect(Array.isArray(ctx.$siblings)).toBe(true)
    expect((ctx.$siblings as SchemaNode[]).length).toBe(2)
    const types = (ctx.$siblings as SchemaNode[]).map(s => s.type)
    expect(types).toContain('span')
    expect(types).toContain('span')
    expect(types).not.toContain('button')
  })

  it('ctx.$children 为 schema.children 数组或 undefined', () => {
    const map: ParentMap = new WeakMap()
    const child = node('span')
    const withChildren = node('div', [child])
    map.set(withChildren, null)
    const ctxWith: Record<string, unknown> = {}
    applyNodeContextToCtx(ctxWith, withChildren, undefined, map)
    expect(ctxWith.$children).toEqual([child])

    const leaf = node('button')
    map.set(leaf, null)
    const ctxLeaf: Record<string, unknown> = {}
    applyNodeContextToCtx(ctxLeaf, leaf, undefined, map)
    expect(ctxLeaf.$children).toBeUndefined()
  })
})
