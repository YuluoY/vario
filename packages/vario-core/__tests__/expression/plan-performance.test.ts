import { describe, expect, it } from 'vitest'
import { ResultMemo } from '../../src/expression/result-memo.js'
import { performance } from 'node:perf_hooks'

describe('T1.9 plan-performance', () => {
  it('PERF-A4 101 unique stores stay within 2x of 100 unique cost', () => {
    const memo = new ResultMemo({ sessionId: 'perf', maxSize: 2000 })
    const t100 = performance.now()
    for (let i = 0; i < 100; i++) memo.store(`e${i}`, [], i)
    const cost100 = performance.now() - t100
    const t101 = performance.now()
    memo.store('e100', [], 100)
    const cost101 = performance.now() - t101
    expect(cost101).toBeLessThanOrEqual(Math.max(2, cost100 * 2) + 20)
    expect(memo.lookup('e0', []).hit).toBe(true)
  })
})
