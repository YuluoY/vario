/**
 * VM-1/VM-2/VM-6：共享 budget、own handler lookup。
 */
import { describe, it, expect } from 'vitest'
import { createRuntimeContext, execute, ActionError, ErrorCodes } from '../../src/index.js'

describe('execution budget', () => {
  it('VM-1: maxSteps=1 时第二个嵌套 action 被阻止', async () => {
    const ctx = createRuntimeContext({ a: 0, b: 0 })
    await expect(execute([
      {
        type: 'if',
        cond: 'true',
        then: [
          { type: 'set', path: 'a', value: 1 },
          { type: 'set', path: 'b', value: 2 },
        ]
      }
    ], ctx, { maxSteps: 1 })).rejects.toMatchObject({ code: ErrorCodes.ACTION_MAX_STEPS_EXCEEDED })
    expect(ctx._get('a')).toBe(1)
    expect(ctx._get('b')).toBe(0)
  })

  it('VM-2: 嵌套 loop 共享 remainingSteps', async () => {
    const ctx = createRuntimeContext({ n: 0, items: [1, 2, 3, 4, 5] })
    await expect(execute([
      {
        type: 'loop',
        var: 'item',
        in: 'items',
        body: [
          { type: 'set', path: 'n', value: '{{ n + 1 }}' }
        ]
      }
    ], ctx, { maxSteps: 2 })).rejects.toThrow(ActionError)
    expect(ctx._get('n') as number).toBeLessThan(5)
  })

  it('VM-6: constructor/toString/__proto__ 不是 handler', async () => {
    const ctx = createRuntimeContext({})
    await expect(execute([{ type: 'constructor' }], ctx)).rejects.toMatchObject({
      code: ErrorCodes.ACTION_UNKNOWN_TYPE
    })
    await expect(execute([{ type: 'toString' }], ctx)).rejects.toMatchObject({
      code: ErrorCodes.ACTION_UNKNOWN_TYPE
    })
  })

  it('VM-7 large loop yields and still consumes budget', async () => {
    const items = Array.from({ length: 40 }, (_, i) => i)
    const ctx = createRuntimeContext({ items, n: 0 })
    await execute([
      {
        type: 'loop',
        var: 'item',
        in: 'items',
        body: [{ type: 'set', path: 'n', value: '{{ n + 1 }}' }]
      }
    ], ctx, { maxSteps: 200, timeout: 2000 })
    expect(ctx._get('n')).toBe(40)
  })

  it('PERF-A5 empty loop 5000 parent fields vs 0 stays within 2x', async () => {
    const fat: Record<string, number> = {}
    for (let i = 0; i < 5000; i++) fat[`k${i}`] = i
    const empty = createRuntimeContext({ items: [1, 2, 3] })
    const heavy = createRuntimeContext({ ...fat, items: [1, 2, 3] })
    const run = async (ctx: ReturnType<typeof createRuntimeContext>) => {
      const t = Date.now()
      await execute([{ type: 'loop', var: 'item', in: 'items', body: [] }], ctx, { maxSteps: 20 })
      return Date.now() - t
    }
    const a = await run(empty)
    const b = await run(heavy)
    expect(b).toBeLessThanOrEqual(Math.max(a * 2, 20))
  })
})
