/**
 * 回归测试：emit / batch / paused / disposed 写入语义（FR-14 / FR-7 core 部分）
 *
 * - emit 未提供 data 时 payload 为 undefined（需 $event 时显式写 data: '{{ $event }}'）
 * - batch 回滚按 journal 记录逆序恢复嵌套路径
 * - execute 在 paused 时 emit SESSION_PAUSED 诊断
 * - disposed ctx 上 _set / proxy set 静默忽略并 emit SESSION_DISPOSED_WRITE，不抛
 * - execute 在 disposed ctx 上仍抛 SESSION_DISPOSED
 */

import { describe, it, expect, vi } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context.js'
import { execute } from '../../src/vm/executor.js'
import { RuntimeSession } from '../../src/runtime/runtime-session.js'
import { createDiagnosticSink, type DiagnosticSink } from '../../src/diagnostics/diagnostic-sink.js'
import { ErrorCodes, BatchError } from '../../src/errors.js'

describe('emit 默认 payload', () => {
  it('未提供 data 时 payload 为 undefined', async () => {
    const onEmit = vi.fn()
    const ctx = createRuntimeContext({}, { onEmit })
    await execute([{ type: 'emit', event: 'submit' }], ctx)
    expect(onEmit).toHaveBeenCalledWith('submit', undefined)
  })

  it('需要 $event 时显式写 data: "{{ $event }}"', async () => {
    const onEmit = vi.fn()
    const ctx = createRuntimeContext({}, { onEmit })
    ;(ctx as unknown as Record<string, unknown>).$event = { value: 9 }
    await execute([{ type: 'emit', event: 'change', data: '{{ $event }}' }], ctx)
    expect(onEmit).toHaveBeenCalledWith('change', { value: 9 })
  })
})

describe('batch 嵌套路径回滚', () => {
  it('batch 内 set 嵌套路径失败后恢复原值', async () => {
    const ctx = createRuntimeContext({ form: { name: 'old', email: 'x@y.z' }, flag: true })
    ctx.$methods.ok = () => {
      ctx._set('form.name', 'new')
      ctx._set('form.email', 'changed')
    }
    ctx.$methods.bad = () => {
      throw new Error('nope')
    }
    await expect(
      execute(
        [
          {
            type: 'batch',
            actions: [
              { type: 'call', method: 'ok' },
              { type: 'call', method: 'bad' },
            ],
          },
        ],
        ctx
      )
    ).rejects.toThrow(BatchError)
    expect(ctx._get('form.name')).toBe('old')
    expect(ctx._get('form.email')).toBe('x@y.z')
  })

  it('batch 超时时抛 BatchError 而非 ACTION_TIMEOUT', async () => {
    const ctx = createRuntimeContext({ v: 0 })
    ctx.$methods.slow = () => new Promise(resolve => setTimeout(resolve, 40))
    await expect(
      execute(
        [{ type: 'batch', actions: [{ type: 'call', method: 'slow' }] }],
        ctx,
        { timeout: 10 }
      )
    ).rejects.toThrow(BatchError)
  })
})

describe('paused 语义', () => {
  it('execute 在 paused owner 上 emit SESSION_PAUSED 诊断且不执行', async () => {
    const events: Array<{ name: string; code?: string }> = []
    const sink: DiagnosticSink = {
      emit: e => {
        events.push({ name: e.name, code: e.diagnostic?.code })
      }
    }
    const ctx = createRuntimeContext({ v: 0 })
    ctx.$methods.tick = vi.fn()
    // StateStore 暂停：pausedOwners WeakSet
    const { StateStore } = await import('../../src/state/index.js')
    const store = new StateStore(ctx)
    store.pause()
    await execute([{ type: 'call', method: 'tick' }], ctx, { diagnosticSink: sink })
    expect(ctx.$methods.tick).not.toHaveBeenCalled()
    expect(events.some(e => e.code === ErrorCodes.SESSION_PAUSED)).toBe(true)
    store.resume()
  })
})

describe('disposed 写入语义', () => {
  it('disposed ctx 上 _set 静默忽略并 emit SESSION_DISPOSED_WRITE', () => {
    const events: Array<{ code?: string }> = []
    const sink = createDiagnosticSink({
      emit: e => {
        events.push({ code: e.diagnostic?.code })
      }
    })
    const state = { count: 1 }
    const ctx = createRuntimeContext(state, { diagnosticSink: sink })
    const session = new RuntimeSession(ctx, { diagnosticSink: sink })
    session.dispose()
    expect(() => ctx._set('count', 99)).not.toThrow()
    expect(ctx._get('count')).toBe(1)
    expect(events.some(e => e.code === ErrorCodes.SESSION_DISPOSED_WRITE)).toBe(true)
  })

  it('disposed ctx 上 proxy set 静默忽略并 emit 诊断', () => {
    const events: Array<{ code?: string }> = []
    const sink = createDiagnosticSink({
      emit: e => {
        events.push({ code: e.diagnostic?.code })
      }
    })
    const state = { count: 1 }
    const ctx = createRuntimeContext(state, { diagnosticSink: sink })
    const session = new RuntimeSession(ctx, { diagnosticSink: sink })
    session.dispose()
    expect(() => {
      ;(ctx as unknown as Record<string, unknown>).count = 100
    }).not.toThrow()
    expect(state.count).toBe(1)
    expect(events.some(e => e.code === ErrorCodes.SESSION_DISPOSED_WRITE)).toBe(true)
  })

  it('disposed ctx 上 execute 仍抛 SESSION_DISPOSED', async () => {
    const ctx = createRuntimeContext({})
    const session = new RuntimeSession(ctx)
    session.dispose()
    await expect(execute([{ type: 'set', path: 'x', value: 1 }], ctx)).rejects.toMatchObject({
      code: ErrorCodes.SESSION_DISPOSED,
    })
  })
})
