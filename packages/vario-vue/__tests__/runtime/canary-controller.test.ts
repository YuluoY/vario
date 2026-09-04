import { describe, expect, it } from 'vitest'
import { evaluateCanary } from '../../src/runtime/canary-controller.js'
import { getRuntimeMode, setRuntimeMode } from '../../src/runtime/runtime-mode.js'

describe('T5.5 canary controller', () => {
  it('rolls back the session unit on correctness/parity and stops expand on perf/heap', () => {
    setRuntimeMode('prepared')
    const rollback = evaluateCanary({ correctnessOk: false, parityDiffs: 0, unit: 'session' })
    expect(rollback.rolledBack).toBe(true)
    expect(rollback.mode).toBe('legacy')
    expect(rollback.unit).toBe('session')
    expect(rollback.at).toMatch(/T/)
    expect(getRuntimeMode()).toBe('prepared')
    setRuntimeMode('prepared')
    const engineRollback = evaluateCanary({ correctnessOk: false, parityDiffs: 0, unit: 'engine' })
    expect(engineRollback.rolledBack).toBe(true)
    expect(getRuntimeMode()).toBe('legacy')
    setRuntimeMode('prepared')
    const hold = evaluateCanary({ correctnessOk: true, parityDiffs: 0, heapOverBudget: true })
    expect(hold.rolledBack).toBe(false)
    expect(hold.reason).toMatch(/perf\/heap/)
    setRuntimeMode('prepared')
  })

  it('isolates engine runtime mode from the global default', () => {
    setRuntimeMode('prepared')
    expect(getRuntimeMode()).toBe('prepared')
    setRuntimeMode('legacy', { engineId: 'eng-a' })
    expect(getRuntimeMode()).toBe('prepared')
    expect(getRuntimeMode('eng-a')).toBe('legacy')
    expect(getRuntimeMode('eng-b')).toBe('prepared')
    setRuntimeMode('prepared', { engineId: 'eng-a' })
    expect(getRuntimeMode('eng-a')).toBe('prepared')
    setRuntimeMode('legacy')
  })

  it('session+engineId correctness rollback does not change the global mode', () => {
    setRuntimeMode('prepared')
    const decision = evaluateCanary({
      correctnessOk: false,
      parityDiffs: 0,
      unit: 'session',
      engineId: 's1'
    })
    expect(decision.rolledBack).toBe(true)
    expect(getRuntimeMode()).toBe('prepared')
    expect(getRuntimeMode('s1')).toBe('legacy')
    setRuntimeMode('prepared', { engineId: 's1' })
  })
})
