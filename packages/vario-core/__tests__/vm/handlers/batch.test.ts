/**
 * batch 动作处理器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createRuntimeContext } from '../../../src/runtime/create-context.js'
import { execute } from '../../../src/vm/executor.js'
import { ActionError } from '../../../src/errors.js'

describe('batch 动作', () => {
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    ctx = createRuntimeContext({
      a: 0,
      b: 0,
      c: 0
    })
  })

  it('应该批量执行所有动作', async () => {
    await execute([
      {
        type: 'batch',
        actions: [
          { type: 'set', path: 'a', value: 1 },
          { type: 'set', path: 'b', value: 2 },
          { type: 'set', path: 'c', value: 3 }
        ]
      }
    ], ctx)

    expect(ctx.a).toBe(1)
    expect(ctx.b).toBe(2)
    expect(ctx.c).toBe(3)
  })

  it('应该在某个动作失败时继续执行其他动作并汇总错误', async () => {
    // 注册一个会失败的方法
    ctx.$methods['failing'] = async () => {
      throw new Error('Intentional failure')
    }

    // batch 内部 BatchError 被 executor 的 executeActions 包装为 ActionError
    await expect(
      execute([
        {
          type: 'batch',
          actions: [
            { type: 'set', path: 'a', value: 1 },
            { type: 'call', method: 'failing' },
            { type: 'set', path: 'c', value: 3 }
          ]
        }
      ], ctx)
    ).rejects.toThrow()
  })

  it('应该在缺少 actions 参数时抛出错误', async () => {
    await expect(
      execute([{ type: 'batch' }], ctx)
    ).rejects.toThrow('actions')
  })

  it('应该在 actions 不是数组时抛出错误', async () => {
    await expect(
      execute([{ type: 'batch', actions: 'not-array' }], ctx)
    ).rejects.toThrow('actions')
  })

  it('应该支持空 actions 数组', async () => {
    await execute([
      { type: 'batch', actions: [] }
    ], ctx)

    // 无操作
    expect(ctx.a).toBe(0)
  })

  it('应该在所有动作都失败时汇总所有错误', async () => {
    ctx.$methods['fail1'] = async () => { throw new Error('fail1') }
    ctx.$methods['fail2'] = async () => { throw new Error('fail2') }

    // batch 收集错误后 BatchError 被 executor 包装为 ActionError
    await expect(
      execute([
        {
          type: 'batch',
          actions: [
            { type: 'call', method: 'fail1' },
            { type: 'call', method: 'fail2' }
          ]
        }
      ], ctx)
    ).rejects.toThrow()
  })
})
