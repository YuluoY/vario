/**
 * SEC-7 / EXPR-1/4：policy fingerprint 不串缓存；null/0/false 可命中。
 */
import { describe, it, expect } from 'vitest'
import {
  createRuntimeContext,
  evaluate,
  lookupCachedExpression,
  setCachedExpression,
  getCachedExpression,
} from '../../src/index.js'
import { getPolicyFingerprint } from '../../src/expression/policy.js'

describe('expression policy cache', () => {
  it('EXPR-1: null/undefined/false/0 可缓存并区分 miss', () => {
    const ctx = createRuntimeContext({ a: null, b: undefined, c: false, d: 0 })
    expect(evaluate('a', ctx)).toBeNull()
    expect(lookupCachedExpression('a', ctx)).toEqual({ hit: true, value: null })
    expect(evaluate('c', ctx)).toBe(false)
    expect(evaluate('d', ctx)).toBe(0)
    expect(lookupCachedExpression('c', ctx)).toEqual({ hit: true, value: false })
    expect(lookupCachedExpression('d', ctx)).toEqual({ hit: true, value: 0 })
    expect(lookupCachedExpression('missing-expr-xyz', ctx).hit).toBe(false)
  })

  it('SEC-7: 不同 policy fingerprint 不共享结果', () => {
    const low = createRuntimeContext({ n: 1 })
    const high = createRuntimeContext({ n: 1 }, { exprOptions: { allowGlobals: true } })
    expect(getPolicyFingerprint(low.$exprOptions)).not.toBe(getPolicyFingerprint(high.$exprOptions))
    evaluate('n + 1', low)
    expect(lookupCachedExpression('n + 1', high).hit).toBe(false)
    expect(lookupCachedExpression('n + 1', low).hit).toBe(true)
  })

  it('EXPR-4: 99/100/101 unique 工作集全部命中；2001 淘汰 1 条而非全清', () => {
    const ctx = createRuntimeContext({ n: 1 })
    for (let i = 0; i < 101; i++) {
      setCachedExpression(`e${i}`, i, [], ctx)
    }
    expect(getCachedExpression('e0', ctx)).toBe(0)
    expect(getCachedExpression('e100', ctx)).toBe(100)
    for (let i = 0; i < 2001; i++) {
      setCachedExpression(`f${i}`, i, [], ctx)
    }
    expect(getCachedExpression('f0', ctx)).toBeNull()
    expect(getCachedExpression('f2000', ctx)).toBe(2000)
    expect(getCachedExpression('f2', ctx)).not.toBeNull()
  })
})
