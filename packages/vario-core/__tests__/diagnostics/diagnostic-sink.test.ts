import { describe, expect, it } from 'vitest'
import { createDiagnosticSink, noopDiagnosticSink } from '../../src/diagnostics/diagnostic-sink.js'

describe('OBS diagnostic sink', () => {
  it('does not serialize state/token/expression and sink throw does not throw', () => {
    const events: unknown[] = []
    const sink = createDiagnosticSink({
      emit(event) {
        events.push(event)
        throw new Error('sink boom')
      }
    })
    expect(() => sink.emit({
      name: 'action',
      sessionId: 's1',
      diagnostic: { code: 'X', message: 'token=secret expression=foo', path: 'n', phase: 'eval' } as never
    })).not.toThrow()
    expect((events[0] as { diagnostic: { message: string } }).diagnostic.message).toBe('X')
    expect(() => noopDiagnosticSink.emit({ name: 'noop' })).not.toThrow()
  })

  it('OBS-5 samples and drops when queue is full', () => {
    const sampled: number[] = []
    const sampledSink = createDiagnosticSink({
      emit() {
        sampled.push(1)
      }
    }, { sampleRate: 0, maxQueue: 256 })
    for (let i = 0; i < 20; i++) sampledSink.emit({ name: 'x' })
    expect(sampled.length).toBe(0)
    let entered = 0
    const nested = createDiagnosticSink({
      emit() {
        entered += 1
        if (entered === 1) nested.emit({ name: 'second' })
      }
    }, { sampleRate: 1, maxQueue: 1 })
    nested.emit({ name: 'first' })
    expect(entered).toBe(1)
  })

  it('OBS-1/2/3/4 keep stable ids, no-op sink, and strip metadata', () => {
    const events: Array<{ name: string; sessionId?: string; nodeId?: string; planId?: string; executionId?: string }> = []
    const sink = createDiagnosticSink({
      emit(event) {
        events.push(event)
      }
    })
    sink.emit({
      name: 'compile',
      sessionId: 'pses_1',
      nodeId: 'node:root',
      planId: 'plan:1',
      executionId: 'ex:1',
      count: 1,
      diagnostic: {
        code: 'OBS',
        message: 'ok',
        path: 'n',
        phase: 'compile',
        metadata: { stack: 'Error: secret', token: 'abc', node: 'root' }
      } as never
    })
    sink.emit({ name: 'render', sessionId: 'pses_1', nodeId: 'node:root', durationMs: 2 })
    sink.emit({ name: 'cache', sessionId: 'pses_1', count: 3 })
    sink.emit({ name: 'page', sessionId: 'pses_1' })
    sink.emit({ name: 'action', sessionId: 'pses_1', executionId: 'ex:1' })
    expect(events.map(e => e.name)).toEqual(['compile', 'render', 'cache', 'page', 'action'])
    expect(new Set(events.map(e => e.sessionId)).size).toBe(1)
    expect(JSON.stringify(events[0])).not.toMatch(/secret|abc/)
    expect(() => noopDiagnosticSink.emit({ name: 'compile' })).not.toThrow()
  })

  it('OBS error events keep engineId/pageId/schemaId/revision/nodeId/actionId/expressionId/phase', () => {
    const events: Array<{
      engineId?: string
      pageId?: string
      schemaId?: string
      revision?: number
      nodeId?: string
      actionId?: string
      expressionId?: string
      diagnostic?: { phase: string; engineId?: string }
    }> = []
    const sink = createDiagnosticSink({ emit(event) { events.push(event) } })
    sink.emit({
      name: 'render-error',
      engineId: 'eng-1',
      pageId: 'pses_1',
      schemaId: 'view:root:1',
      revision: 3,
      nodeId: 'node:root',
      actionId: 'click',
      expressionId: 'plan:1',
      diagnostic: {
        code: 'RENDER_ERROR',
        message: 'ok',
        path: '',
        phase: 'render',
        engineId: 'eng-1',
        pageId: 'pses_1',
        schemaId: 'view:root:1',
        revision: 3,
        nodeId: 'node:root',
        actionId: 'click',
        expressionId: 'plan:1'
      }
    })
    expect(events[0]).toMatchObject({
      engineId: 'eng-1',
      pageId: 'pses_1',
      schemaId: 'view:root:1',
      revision: 3,
      nodeId: 'node:root',
      actionId: 'click',
      expressionId: 'plan:1'
    })
    expect(events[0].diagnostic?.phase).toBe('render')
    expect(events[0].diagnostic?.engineId).toBe('eng-1')
  })
})
