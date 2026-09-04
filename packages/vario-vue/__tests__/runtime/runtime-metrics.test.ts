import { describe, expect, it } from 'vitest'
import { createRuntimeMetricsSink, recordRuntimeMetric, recordInteractionBudget } from '../../src/runtime/runtime-metrics.js'

describe('T5.3 runtime metrics', () => {
  it('records stable ids without state/token payload and sink throw is ignored', () => {
    const seen: Array<{ name: string; sessionId?: string }> = []
    const inner = {
      emit(event: { name: string; sessionId?: string }) {
        seen.push(event)
        throw new Error('metrics boom')
      }
    }
    const sink = createRuntimeMetricsSink(inner)
    expect(() => recordRuntimeMetric({
      name: 'prepare',
      sessionId: 'pses_1',
      nodeId: 'node:root',
      planId: 'plan:1',
      executionId: 'ex:1',
      durationMs: 1,
      count: 2
    }, sink)).not.toThrow()
    expect(seen[0]).toMatchObject({ name: 'prepare', sessionId: 'pses_1' })
    expect(JSON.stringify(seen[0])).not.toMatch(/token|password/)
    recordInteractionBudget({ nodeId: 'node:root', actionId: 'call', durationMs: 3 }, sink)
    expect(seen[1]).toMatchObject({ name: 'interaction', nodeId: 'node:root', executionId: 'call', durationMs: 3 })
    recordRuntimeMetric({ name: 'long-task', nodeId: 'node:root', durationMs: 51, count: 1 }, sink)
    recordRuntimeMetric({ name: 'cancel', executionId: 'ex:abort', sessionId: 'pses_1' }, sink)
    recordRuntimeMetric({ name: 'rollback', sessionId: 'pses_1', count: 1 }, sink)
    expect(seen.map(e => e.name)).toEqual(['prepare', 'interaction', 'long-task', 'cancel', 'rollback'])
  })
})
