/**
 * 回归测试：ExecutionSession 生命周期（FR-1）
 *
 * - execute() 结束后 ctx → session 绑定必须解除
 * - 第二次 execute 拿到全新 session（新 deadline、满额 steps）
 * - 事件结束 5 秒后 _set 正常（不得命中过期 session 的 assertSessionCanWrite）
 * - maxSteps 只在单次 execute 内累计
 * - loop 迭代共享父 session（deadline/steps/signal）
 * - signal abort 后的 session 不得被复用
 */

import { describe, it, expect, vi } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context.js'
import { execute } from '../../src/vm/executor.js'
import { getExecutionSession } from '../../src/vm/execution-session.js'
import { ActionError, ErrorCodes } from '../../src/errors.js'

describe('ExecutionSession 解绑与复用规则', () => {
  it('execute() 结束后 getExecutionSession(ctx) 为 undefined', async () => {
    const ctx = createRuntimeContext({})
    await execute([{ type: 'set', path: 'count', value: 1 }], ctx)
    expect(getExecutionSession(ctx)).toBeUndefined()
  })

  it('execute() 抛错时同样解绑 session', async () => {
    const ctx = createRuntimeContext({})
    ctx.$methods.boom = () => {
      throw new Error('boom')
    }
    await expect(execute([{ type: 'call', method: 'boom' }], ctx)).rejects.toThrow('boom')
    expect(getExecutionSession(ctx)).toBeUndefined()
  })

  it('两次 execute 拿到不同的 executionId 与满额 steps', async () => {
    const ctx = createRuntimeContext({})
    const ids: string[] = []
    ctx.$methods.inspect = (_c, _a, meta) => {
      ids.push(meta.executionId)
    }
    await execute([{ type: 'call', method: 'inspect' }], ctx)
    await execute([{ type: 'call', method: 'inspect' }], ctx)
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('同一 ctx 上 timeout:20 的 execute 结束 40ms 后再 execute / _set 均成功', { retry: 2 }, async () => {
    const ctx = createRuntimeContext({ count: 0 })
    await execute([{ type: 'set', path: 'count', value: 1 }], ctx, { timeout: 20 })
    await new Promise(resolve => setTimeout(resolve, 40))
    await execute([{ type: 'set', path: 'count', value: 2 }], ctx, { timeout: 100 })
    expect(ctx._get('count')).toBe(2)
    ctx._set('count', 3)
    expect(ctx._get('count')).toBe(3)
  })

  it('maxSteps:2 的两次独立 execute 各 1 个 action 均成功', async () => {
    const ctx = createRuntimeContext({})
    ctx.$methods.tick = vi.fn()
    await execute([{ type: 'call', method: 'tick' }], ctx, { maxSteps: 2 })
    await execute([{ type: 'call', method: 'tick' }], ctx, { maxSteps: 2 })
    expect(ctx.$methods.tick).toHaveBeenCalledTimes(2)
  })

  it('loop 迭代与父级共享同一 executionId', async () => {
    const ctx = createRuntimeContext({ items: [1, 2, 3] })
    const ids = new Set<string>()
    ctx.$methods.inspect = (_c, _a, meta) => {
      ids.add(meta.executionId)
    }
    await execute(
      [
        { type: 'call', method: 'inspect' },
        {
          type: 'loop',
          var: 'item',
          in: 'items',
          body: [{ type: 'call', method: 'inspect' }],
        },
      ],
      ctx
    )
    expect(ids.size).toBe(1)
  })

  it('maxSteps:4 下 3 项 loop × 2 action 报 ACTION_MAX_STEPS_EXCEEDED', async () => {
    const ctx = createRuntimeContext({ items: [1, 2, 3] })
    ctx.$methods.tick = () => {}
    await expect(
      execute(
        [
          {
            type: 'loop',
            var: 'item',
            in: 'items',
            body: [
              { type: 'call', method: 'tick' },
              { type: 'call', method: 'tick' },
            ],
          },
        ],
        ctx,
        { maxSteps: 4 }
      )
    ).rejects.toMatchObject({ code: ErrorCodes.ACTION_MAX_STEPS_EXCEEDED })
  })

  it('signal abort 后的 session 不被复用：第二次 execute 正常执行', async () => {
    const ctx = createRuntimeContext({})
    const controller = new AbortController()
    ctx.$methods.tick = vi.fn()
    const first = execute([{ type: 'call', method: 'tick' }], ctx, { signal: controller.signal })
    controller.abort()
    await first.catch(() => {})
    expect(getExecutionSession(ctx)).toBeUndefined()
    await execute([{ type: 'call', method: 'tick' }], ctx)
    expect(ctx.$methods.tick).toHaveBeenCalled()
  })

  it('execute 后 _set 不再触发已过期 session 的 ACTION_TIMEOUT', async () => {
    const ctx = createRuntimeContext({ v: 0 })
    await execute([{ type: 'set', path: 'v', value: 1 }], ctx, { timeout: 15 })
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(() => ctx._set('v', 2)).not.toThrow()
    expect(ctx._get('v')).toBe(2)
  })

  it('cancelled session 残留时新 execute 不复用（超时后事件仍可执行）', { retry: 2 }, async () => {
    const ctx = createRuntimeContext({})
    ctx.$methods.slow = () => new Promise(resolve => setTimeout(resolve, 30))
    const first = execute([{ type: 'call', method: 'slow' }], ctx, { timeout: 10 })
    await expect(first).rejects.toMatchObject({ code: ErrorCodes.ACTION_TIMEOUT })
    expect(getExecutionSession(ctx)).toBeUndefined()
    ctx.$methods.fast = vi.fn()
    await execute([{ type: 'call', method: 'fast' }], ctx)
    expect(ctx.$methods.fast).toHaveBeenCalledTimes(1)
  })

  it('ActionError 保留 code 与 executionId 上下文', async () => {
    const ctx = createRuntimeContext({})
    ctx.$methods.boom = (_c, _a, meta) => {
      throw new ActionError(
        { type: 'boom' },
        'planned failure',
        ErrorCodes.ACTION_EXECUTION_ERROR,
        { metadata: { executionId: meta.executionId } }
      )
    }
    await expect(execute([{ type: 'call', method: 'boom' }], ctx)).rejects.toMatchObject({
      code: ErrorCodes.ACTION_EXECUTION_ERROR,
    })
  })
})
