import { describe, expect, it } from 'vitest'
import { detectVueCapabilities } from '../../src/runtime/vue-capabilities.js'
import { getRuntimeMode, setRuntimeMode } from '../../src/runtime/runtime-mode.js'
import { compareShadowPlans } from '../../src/runtime/shadow-comparator.js'
import { evaluateCanary } from '../../src/runtime/canary-controller.js'
import { recordRuntimeMetric, createRuntimeMetricsSink } from '../../src/runtime/runtime-metrics.js'
import { prepareView } from '@variojs/schema'

describe('T4.3 vue capabilities', () => {
  it('detects pause/resume without changing public return shape', () => {
    const caps = detectVueCapabilities()
    expect(typeof caps.effectScopePause).toBe('boolean')
    expect(caps.version).toMatch(/^3\./)
  })
})

describe('T5.1 runtime mode', () => {
  it('defaults to legacy and switches without API change', () => {
    expect(getRuntimeMode()).toBe('legacy')
    setRuntimeMode('shadow')
    expect(getRuntimeMode()).toBe('shadow')
    setRuntimeMode('prepared')
    expect(getRuntimeMode()).toBe('prepared')
    setRuntimeMode('legacy')
    expect(getRuntimeMode()).toBe('legacy')
  })
})

describe('T5.2 shadow comparator', () => {
  it('returns empty diffs for equal plans', () => {
    const schema = { type: 'div', children: 'x' } as never
    expect(compareShadowPlans(schema, prepareView(schema))).toEqual([])
  })
})

describe('T5.3 runtime metrics', () => {
  it('sink throw does not break emit', () => {
    const sink = createRuntimeMetricsSink({ emit() { throw new Error('boom') } })
    expect(() => recordRuntimeMetric({ name: 'render', sessionId: 's' }, sink)).not.toThrow()
  })
})

describe('T5.5 canary', () => {
  it('rolls back on parity diffs', () => {
    expect(evaluateCanary({ correctnessOk: true, parityDiffs: 2 }).rolledBack).toBe(true)
    setRuntimeMode('legacy')
  })
})

describe('T5.7 canary 1/10/50 rehearsal', () => {
  it('records timestamps and rolls back injected faults without API change', () => {
    const stages = [1, 10, 50].map(percent => {
      const decision = evaluateCanary({
        correctnessOk: percent !== 10,
        parityDiffs: percent === 10 ? 1 : 0,
        unit: 'session'
      })
      return { percent, at: decision.at, mode: decision.mode, rolledBack: decision.rolledBack }
    })
    expect(stages[0].percent).toBe(1)
    expect(stages[1].rolledBack).toBe(true)
    expect(stages[2].percent).toBe(50)
    setRuntimeMode('legacy')
    expect(getRuntimeMode()).toBe('legacy')
    setRuntimeMode('prepared')
    expect(stages.every(s => typeof s.at === 'string' && s.at.includes('T'))).toBe(true)
  })
})
