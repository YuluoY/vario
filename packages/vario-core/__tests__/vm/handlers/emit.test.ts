/**
 * emit 动作处理器测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRuntimeContext } from '../../../src/runtime/create-context.js'
import { execute } from '../../../src/vm/executor.js'

describe('emit 动作', () => {
  let onEmit: ReturnType<typeof vi.fn>
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    onEmit = vi.fn()
    ctx = createRuntimeContext(
      { message: 'hello', userId: 42 },
      { onEmit }
    )
  })

  it('应该触发事件', async () => {
    await execute([
      { type: 'emit', event: 'submit' }
    ], ctx)

    expect(onEmit).toHaveBeenCalledWith('submit', undefined)
  })

  it('未写 data 时 payload 为 undefined（FR-14：需要 $event 时显式声明）', async () => {
    ctx.$event = { type: 'click', target: 'btn' }
    await execute([
      { type: 'emit', event: 'submit' }
    ], ctx)

    expect(onEmit).toHaveBeenCalledWith('submit', undefined)
  })

  it('显式写 data: "{{ $event }}" 时 payload 为当前 $event', async () => {
    ctx.$event = { type: 'click', target: 'btn' }
    await execute([
      { type: 'emit', event: 'submit', data: '{{ $event }}' }
    ], ctx)

    expect(onEmit).toHaveBeenCalledWith('submit', { type: 'click', target: 'btn' })
  })

  it('应该触发带数据的事件', async () => {
    await execute([
      { type: 'emit', event: 'update', data: { key: 'value' } }
    ], ctx)

    expect(onEmit).toHaveBeenCalledWith('update', { key: 'value' })
  })

  it('应该支持表达式数据', async () => {
    await execute([
      { type: 'emit', event: 'change', data: '{{ userId }}' }
    ], ctx)

    expect(onEmit).toHaveBeenCalledWith('change', 42)
  })

  it('应该在缺少 event 参数时抛出错误', async () => {
    await expect(
      execute([{ type: 'emit' }], ctx)
    ).rejects.toThrow('event')
  })

  it('应该在 event 不是字符串时抛出错误', async () => {
    await expect(
      execute([{ type: 'emit', event: 123 }], ctx)
    ).rejects.toThrow('event')
  })

  it('应该连续触发多个事件', async () => {
    await execute([
      { type: 'emit', event: 'first', data: 1 },
      { type: 'emit', event: 'second', data: 2 }
    ], ctx)

    expect(onEmit).toHaveBeenCalledTimes(2)
    expect(onEmit).toHaveBeenCalledWith('first', 1)
    expect(onEmit).toHaveBeenCalledWith('second', 2)
  })

  it('应该在没有注册 onEmit 时也不抛错', async () => {
    const ctxNoEmit = createRuntimeContext({ count: 0 })

    await expect(
      execute([{ type: 'emit', event: 'test' }], ctxNoEmit)
    ).resolves.toBeUndefined()
  })

  it('emits action-start and action-end through diagnosticSink', async () => {
    const names: string[] = []
    await execute(
      [{ type: 'emit', event: 'submit' }],
      ctx,
      { diagnosticSink: { emit(event) { names.push(event.name) } } }
    )
    expect(names).toEqual(['action-start', 'action-end'])
  })

  it('action diagnostics include actionId', async () => {
    const events: Array<{ name: string; actionId?: string }> = []
    await execute(
      [{ type: 'emit', event: 'submit' }],
      ctx,
      { diagnosticSink: { emit(event) { events.push({ name: event.name, actionId: event.actionId }) } } }
    )
    expect(events.every(e => e.actionId === 'emit')).toBe(true)
  })
})
