/**
 * VM-5：batch 失败回滚到 batch 前，保留每个失败 action。
 */
import { describe, it, expect } from 'vitest'
import { createRuntimeContext, execute, BatchError } from '../../src/index.js'

describe('batch atomicity', () => {
  it('任一动作失败后 state 恢复到 batch 前', async () => {
    const ctx = createRuntimeContext({ a: 0, b: 0, c: 0 })
    ctx.$methods.failing = async () => {
      throw new Error('boom')
    }

    await expect(execute([
      {
        type: 'batch',
        actions: [
          { type: 'set', path: 'a', value: 1 },
          { type: 'call', method: 'failing' },
          { type: 'set', path: 'c', value: 3 },
        ]
      }
    ], ctx)).rejects.toBeInstanceOf(BatchError)

    expect(ctx._get('a')).toBe(0)
    expect(ctx._get('b')).toBe(0)
    expect(ctx._get('c')).toBe(0)
  })

  it('BatchError 不被二次包装且保留每个失败 action', async () => {
    const ctx = createRuntimeContext({ a: 0 })
    ctx.$methods.fail1 = async () => { throw new Error('fail1') }
    ctx.$methods.fail2 = async () => { throw new Error('fail2') }

    try {
      await execute([
        {
          type: 'batch',
          actions: [
            { type: 'call', method: 'fail1' },
            { type: 'call', method: 'fail2' },
          ]
        }
      ], ctx)
      expect.fail('should throw')
    } catch (e) {
      expect(e).toBeInstanceOf(BatchError)
      const err = e as BatchError
      expect(err.failedActions).toHaveLength(2)
      expect(err.failedActions[0].action).toMatchObject({ type: 'call', method: 'fail1' })
      expect(err.failedActions[1].action).toMatchObject({ type: 'call', method: 'fail2' })
    }
  })

  it('emits action-rollback when batch restores state', async () => {
    const ctx = createRuntimeContext({ a: 0 })
    ctx.$methods.failing = async () => {
      throw new Error('boom')
    }
    const names: string[] = []
    await expect(execute([
      {
        type: 'batch',
        actions: [
          { type: 'set', path: 'a', value: 1 },
          { type: 'call', method: 'failing' }
        ]
      }
    ], ctx, { diagnosticSink: { emit(event) { names.push(event.name) } } })).rejects.toBeInstanceOf(BatchError)
    expect(ctx._get('a')).toBe(0)
    expect(names).toContain('action-rollback')
    // execute 结束后 session 必须解绑（FR-1），不得残留
    const { getExecutionSession } = await import('../../src/vm/execution-session.js')
    expect(getExecutionSession(ctx)).toBeUndefined()
  })
})
