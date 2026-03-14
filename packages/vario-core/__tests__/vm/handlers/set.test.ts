/**
 * set 动作处理器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createRuntimeContext } from '../../../src/runtime/create-context.js'
import { execute } from '../../../src/vm/executor.js'

describe('set 动作', () => {
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    ctx = createRuntimeContext({
      count: 0,
      user: { name: 'Alice', age: 25 },
      items: [1, 2, 3]
    })
  })

  it('应该设置简单路径的值', async () => {
    await execute([
      { type: 'set', path: 'count', value: 10 }
    ], ctx)

    expect(ctx.count).toBe(10)
  })

  it('应该设置嵌套路径的值', async () => {
    await execute([
      { type: 'set', path: 'user.name', value: 'Bob' }
    ], ctx)

    expect(ctx.user).toEqual({ name: 'Bob', age: 25 })
  })

  it('应该支持表达式求值', async () => {
    await execute([
      { type: 'set', path: 'count', value: '{{ count + 1 }}' }
    ], ctx)

    expect(ctx.count).toBe(1)
  })

  it('应该支持设置对象类型的值', async () => {
    await execute([
      { type: 'set', path: 'user', value: { name: 'Charlie', age: 30 } }
    ], ctx)

    expect(ctx.user).toEqual({ name: 'Charlie', age: 30 })
  })

  it('应该支持设置数组类型的值', async () => {
    await execute([
      { type: 'set', path: 'items', value: [4, 5, 6] }
    ], ctx)

    expect(ctx.items).toEqual([4, 5, 6])
  })

  it('应该在缺少 path 参数时抛出错误', async () => {
    await expect(
      execute([{ type: 'set', value: 10 }], ctx)
    ).rejects.toThrow('path')
  })

  it('应该支持设置 null 值', async () => {
    await execute([
      { type: 'set', path: 'user.name', value: null }
    ], ctx)

    expect(ctx.user.name).toBeNull()
  })

  it('应该支持设置 undefined (不传 value)', async () => {
    await execute([
      { type: 'set', path: 'count' }
    ], ctx)

    expect(ctx.count).toBeUndefined()
  })

  it('应该连续设置多个值', async () => {
    await execute([
      { type: 'set', path: 'count', value: 5 },
      { type: 'set', path: 'user.name', value: 'David' }
    ], ctx)

    expect(ctx.count).toBe(5)
    expect(ctx.user.name).toBe('David')
  })
})
