import { describe, expect, it } from 'vitest'
import { compileExpressionPlan } from '../../src/expression/plan-compiler.js'
import { evaluateExpressionPlan } from '../../src/expression/plan-evaluator.js'
import { createRuntimeContext } from '../../src/runtime/create-context.js'
import { createScopeFrame, type ScopeTable } from '../../src/scope/scope-frame.js'
import { ResultMemo } from '../../src/expression/result-memo.js'

describe('T1.5 ExpressionPlan', () => {
  it('is frozen and distinguishes state/local/dynamic deps', () => {
    const plan = compileExpressionPlan('item.label + count')
    expect(Object.isFrozen(plan)).toBe(true)
    expect(plan.localDeps.some(d => d.startsWith('item'))).toBe(true)
    expect(plan.stateDeps).toContain('count')
    expect(plan.policyFingerprint).toBeTruthy()
    expect(plan.pure).toBe(true)
    expect(plan.cost).toBeGreaterThan(0)
    expect(plan.estimatedCost).toBe(plan.cost)
    expect(plan.dependencyMode).toBe('prefix')
    expect(plan.ast).toBeTruthy()
  })

  it('plan id includes policy fingerprint', () => {
    const a = compileExpressionPlan('count')
    expect(a.id).toContain(a.policyFingerprint)
  })

  it('values[0] records precise stateDep values.0', () => {
    const plan = compileExpressionPlan('values[0]')
    expect(plan.stateDeps).toContain('values.0')
    expect(plan.stateDeps.some(d => d.endsWith('.*'))).toBe(false)
  })

  it('evaluates from plan.ast without re-parsing the source string', () => {
    const ctx = createRuntimeContext({ n: 7, count: 2 })
    expect(evaluateExpressionPlan(compileExpressionPlan('n'), ctx)).toBe(7)
    const table: ScopeTable = new Map()
    const frame = createScopeFrame(null, { item: { label: 'L' } })
    table.set(frame.id, frame)
    expect(evaluateExpressionPlan(compileExpressionPlan('item.label + count'), ctx, { frame, table })).toBe('L2')
  })

  it('does not reuse ResultMemo across sibling loop frames with the same generation', () => {
    const memo = new ResultMemo({ sessionId: 'loop-items' })
    const table: ScopeTable = new Map()
    const a = createScopeFrame(null, { item: { label: 'a' } })
    const b = createScopeFrame(null, { item: { label: 'b' } })
    table.set(a.id, a)
    table.set(b.id, b)
    const plan = compileExpressionPlan('item.label')
    const ctx = createRuntimeContext({})
    expect(a.generation).toBe(b.generation)
    expect(evaluateExpressionPlan(plan, ctx, { memo, frame: a, table })).toBe('a')
    expect(evaluateExpressionPlan(plan, ctx, { memo, frame: b, table })).toBe('b')
  })

  it('rejects assignment at compile time', () => {
    expect(() => compileExpressionPlan('user.name = "x"')).toThrow()
  })

  it('does not memoize impure Date.now plans', () => {
    const plan = compileExpressionPlan('Date.now()')
    expect(plan.pure).toBe(false)
    const memo = new ResultMemo({ sessionId: 'impure' })
    const ctx = createRuntimeContext({})
    evaluateExpressionPlan(plan, ctx, { memo })
    evaluateExpressionPlan(plan, ctx, { memo })
    expect(memo.stats().size).toBe(0)
  })

  it('memos pure constant plans', () => {
    const plan = compileExpressionPlan('1 + 1')
    expect(plan.pure).toBe(true)
    const memo = new ResultMemo({ sessionId: 'pure' })
    const ctx = createRuntimeContext({})
    expect(evaluateExpressionPlan(plan, ctx, { memo })).toBe(2)
    expect(memo.stats().size).toBe(1)
    expect(evaluateExpressionPlan(plan, ctx, { memo })).toBe(2)
  })
})
