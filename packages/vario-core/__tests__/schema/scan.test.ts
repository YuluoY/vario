import { describe, expect, it } from 'vitest'
import { scanSchemaIterative } from '../../src/schema/scan'

describe('scanSchemaIterative', () => {
  it('scans 10000-deep chain without RangeError', () => {
    let node: { type: string; children?: unknown[] } = { type: 'leaf' }
    for (let i = 0; i < 9999; i++) {
      node = { type: 'div', children: [node] }
    }
    const result = scanSchemaIterative(node as never)
    expect(result.maxDepth).toBe(10000)
    expect(result.nodeCount).toBe(10000)
  })
})

import { compileExpressionPlan } from '../../src/expression/plan-compiler.js'

describe('T1.5 ExpressionPlan', () => {
  it('freezes plan and splits state/local deps', () => {
    const plan = compileExpressionPlan('user.name + item.label')
    expect(Object.isFrozen(plan)).toBe(true)
    expect(plan.stateDeps.some(d => d.startsWith('user'))).toBe(true)
    expect(plan.localDeps.length).toBeGreaterThan(0)
    expect(plan.id).toContain(plan.policyFingerprint)
  })
})
