import { describe, expect, it } from 'vitest'
import { compileExpressionPlan } from '../../src/expression/plan-compiler.js'
import { evaluateExpressionPlan } from '../../src/expression/plan-evaluator.js'
import { createScopeFrame, type ScopeTable } from '../../src/scope/scope-frame.js'
import { createRuntimeContext } from '../../src/runtime/create-context.js'

describe('T3.2 lexical precedence', () => {
  it('local > parent local > state', () => {
    const ctx = createRuntimeContext({ item: 'state', count: 7 })
    const table: ScopeTable = new Map()
    const parent = createScopeFrame(null, { item: 'parent' })
    const child = createScopeFrame(parent, { item: 'child' })
    table.set(parent.id, parent)
    table.set(child.id, child)
    const plan = compileExpressionPlan('item')
    expect(evaluateExpressionPlan(plan, ctx, { frame: child, table })).toBe('child')
    expect(evaluateExpressionPlan(plan, ctx, { frame: parent, table })).toBe('parent')
    expect(evaluateExpressionPlan(plan, ctx)).toBe('state')
  })
})
