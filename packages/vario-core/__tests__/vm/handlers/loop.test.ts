/**
 * loop 动作处理器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createRuntimeContext } from '../../../src/runtime/create-context.js'
import { execute } from '../../../src/vm/executor.js'

describe('loop 动作', () => {
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    ctx = createRuntimeContext({
      items: ['a', 'b', 'c'],
      result: [] as string[],
      total: 0,
      users: { alice: 1, bob: 2 }
    })
  })

  it('应该遍历数组', async () => {
    await execute([
      {
        type: 'loop',
        var: 'item',
        in: 'items',
        body: [
          { type: 'push', path: 'result', value: '{{ item }}' }
        ]
      }
    ], ctx)

    expect(ctx.result).toEqual(['a', 'b', 'c'])
  })

  it('应该支持遍历对象', async () => {
    await execute([
      {
        type: 'loop',
        var: 'value',
        in: 'users',
        body: [
          { type: 'set', path: 'total', value: '{{ total + value }}' }
        ]
      }
    ], ctx)

    expect(ctx.total).toBe(3)
  })

  it('应该在 iterable 为 null 时正常跳过', async () => {
    ctx._set('items', null as any)
    await execute([
      {
        type: 'loop',
        var: 'item',
        in: 'items',
        body: [
          { type: 'push', path: 'result', value: '{{ item }}' }
        ]
      }
    ], ctx)

    expect(ctx.result).toEqual([])
  })

  it('应该在缺少 var 参数时抛出错误', async () => {
    await expect(
      execute([
        { type: 'loop', in: 'items', body: [] }
      ], ctx)
    ).rejects.toThrow('var')
  })

  it('应该在缺少 in 参数时抛出错误', async () => {
    await expect(
      execute([
        { type: 'loop', var: 'item', body: [] }
      ], ctx)
    ).rejects.toThrow('in')
  })

  it('应该在缺少 body 参数时抛出错误', async () => {
    await expect(
      execute([
        { type: 'loop', var: 'item', in: 'items' }
      ], ctx)
    ).rejects.toThrow('body')
  })

  it('应该在 in 求值为非可迭代类型时抛出错误', async () => {
    ctx._set('items', 42 as any)
    await expect(
      execute([
        { type: 'loop', var: 'item', in: 'items', body: [] }
      ], ctx)
    ).rejects.toThrow()
  })

  it('应该在空数组时正常跳过', async () => {
    ctx._set('items', [] as any)
    await execute([
      {
        type: 'loop',
        var: 'item',
        in: 'items',
        body: [
          { type: 'push', path: 'result', value: 'x' }
        ]
      }
    ], ctx)

    expect(ctx.result).toEqual([])
  })
})
