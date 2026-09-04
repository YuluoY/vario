/**
 * VM-3/VM-4：timeout/cancel 后不得继续写；AbortSignal 传给 3 参数 handler。
 */
import { describe, it, expect } from 'vitest'
import { createRuntimeContext, execute, ErrorCodes } from '../../src/index.js'

describe('execution cancellation', () => {
  it('VM-3: timeout 后 resultTo 不得继续写 state', async () => {
    const ctx = createRuntimeContext({ done: false, n: 0 })
    ctx.$methods.slow = async () => {
      await new Promise(r => setTimeout(r, 80))
      return 1
    }
    await expect(execute([
      { type: 'call', method: 'slow', resultTo: 'done' }
    ], ctx, { timeout: 20 })).rejects.toMatchObject({ code: ErrorCodes.ACTION_TIMEOUT })
    expect(ctx._get('done')).toBe(false)
  })

  it('VM-4: 三参数 handler 收到 AbortSignal，二参数仍可用', async () => {
    const ctx = createRuntimeContext({ a: 0, b: 0 })
    let received: AbortSignal | undefined
    ctx.$methods.three = async (_c: unknown, _p: unknown, meta?: { signal?: AbortSignal }) => {
      received = meta?.signal
      ctx._set('a', 1)
    }
    ctx.$methods.two = async () => {
      ctx._set('b', 1)
    }
    await execute([
      { type: 'call', method: 'three' },
      { type: 'call', method: 'two' },
    ], ctx)
    expect(received).toBeInstanceOf(AbortSignal)
    expect(ctx._get('a')).toBe(1)
    expect(ctx._get('b')).toBe(1)
  })

  it('外部 abort 后不再写 state', async () => {
    const ctx = createRuntimeContext({ n: 0 })
    const ac = new AbortController()
    ctx.$methods.hang = async () => {
      await new Promise(r => setTimeout(r, 50))
      ctx._set('n', 9)
    }
    const p = execute([{ type: 'call', method: 'hang' }], ctx, { signal: ac.signal, timeout: 5000 })
    ac.abort()
    await expect(p).rejects.toMatchObject({ code: ErrorCodes.ACTION_ABORTED })
    expect(ctx._get('n')).toBe(0)
  })
})
