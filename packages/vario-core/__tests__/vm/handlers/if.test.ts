/**
 * if 动作处理器测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRuntimeContext } from '../../../src/runtime/create-context.js'
import { execute } from '../../../src/vm/executor.js'

describe('if 动作', () => {
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    ctx = createRuntimeContext({
      isAdmin: true,
      age: 20,
      result: ''
    })
  })

  it('应该执行 then 分支（条件为真）', async () => {
    await execute([
      {
        type: 'if',
        cond: 'isAdmin',
        then: [{ type: 'set', path: 'result', value: 'admin' }]
      }
    ], ctx)

    expect(ctx.result).toBe('admin')
  })

  it('应该执行 else 分支（条件为假）', async () => {
    ctx._set('isAdmin', false)
    await execute([
      {
        type: 'if',
        cond: 'isAdmin',
        then: [{ type: 'set', path: 'result', value: 'admin' }],
        else: [{ type: 'set', path: 'result', value: 'user' }]
      }
    ], ctx)

    expect(ctx.result).toBe('user')
  })

  it('应该支持表达式条件', async () => {
    await execute([
      {
        type: 'if',
        cond: '{{ age >= 18 }}',
        then: [{ type: 'set', path: 'result', value: 'adult' }],
        else: [{ type: 'set', path: 'result', value: 'minor' }]
      }
    ], ctx)

    expect(ctx.result).toBe('adult')
  })

  it('应该支持复杂表达式', async () => {
    await execute([
      {
        type: 'if',
        cond: '{{ isAdmin && age > 18 }}',
        then: [{ type: 'set', path: 'result', value: 'admin-adult' }]
      }
    ], ctx)

    expect(ctx.result).toBe('admin-adult')
  })

  it('应该在缺少 cond 时抛出错误', async () => {
    await expect(
      execute([
        { type: 'if', then: [{ type: 'set', path: 'result', value: 'x' }] }
      ], ctx)
    ).rejects.toThrow('cond')
  })

  it('应该在条件为假且无 else 分支时无操作', async () => {
    ctx._set('isAdmin', false)
    await execute([
      {
        type: 'if',
        cond: 'isAdmin',
        then: [{ type: 'set', path: 'result', value: 'admin' }]
      }
    ], ctx)

    expect(ctx.result).toBe('')
  })

  it('应该支持嵌套 if', async () => {
    await execute([
      {
        type: 'if',
        cond: 'isAdmin',
        then: [
          {
            type: 'if',
            cond: '{{ age >= 18 }}',
            then: [{ type: 'set', path: 'result', value: 'admin+adult' }]
          }
        ]
      }
    ], ctx)

    expect(ctx.result).toBe('admin+adult')
  })

  it('应该在 then 为空数组时无操作', async () => {
    await execute([
      { type: 'if', cond: 'isAdmin', then: [] }
    ], ctx)

    expect(ctx.result).toBe('')
  })
})
