/**
 * 回归测试：特殊变量表达式不缓存（FR-3）
 *
 * - 依赖根为 $event/$self/$parent/$siblings/$children 的表达式每次求值
 * - 对这些变量赋值时 invalidateCache 使旧缓存失效
 * - $variables/$datasources/$functions/$utils 命名空间仍可缓存
 * - evaluateExpressionPlan 对特殊变量也不缓存（dynamicDeps 路径）
 */

import { describe, it, expect } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context.js'
import { evaluate } from '../../src/expression/evaluate.js'
import { evaluateExpressionPlan } from '../../src/expression/plan-evaluator.js'
import { compileExpressionPlan } from '../../src/expression/plan-compiler.js'
import { ResultMemo } from '../../src/expression/result-memo.js'
import { invalidateCache } from '../../src/expression/cache.js'

describe('$event 表达式跨事件不串值', () => {
  it('两次事件 {{ $event.target.value }} 分别得到各自的值', () => {
    const ctx = createRuntimeContext({})
    ;(ctx as unknown as Record<string, unknown>).$event = { target: { value: 'a' } }
    expect(evaluate('$event.target.value', ctx)).toBe('a')
    ;(ctx as unknown as Record<string, unknown>).$event = { target: { value: 'b' } }
    expect(evaluate('$event.target.value', ctx)).toBe('b')
  })

  it('每次求值都重新读取（不因缓存命中返回首个值）', () => {
    const ctx = createRuntimeContext({ count: 1 })
    ;(ctx as unknown as Record<string, unknown>).$event = { value: 10 }
    // 先建立一个会被同名 state 依赖干扰的场景
    expect(evaluate('$event.value + count', ctx)).toBe(11)
    ;(ctx as unknown as Record<string, unknown>).$event = { value: 20 }
    expect(evaluate('$event.value + count', ctx)).toBe(21)
  })
})

describe('$self 表达式跨节点不串值', () => {
  it('不同节点的 $self.props.label 取各自值', () => {
    const ctx = createRuntimeContext({})
    ;(ctx as unknown as Record<string, unknown>).$self = { props: { label: 'nodeA' } }
    expect(evaluate('$self.props.label', ctx)).toBe('nodeA')
    ;(ctx as unknown as Record<string, unknown>).$self = { props: { label: 'nodeB' } }
    expect(evaluate('$self.props.label', ctx)).toBe('nodeB')
  })

  it('$parent / $siblings / $children 同样不缓存', () => {
    const ctx = createRuntimeContext({})
    ;(ctx as unknown as Record<string, unknown>).$parent = { title: 'p1' }
    expect(evaluate('$parent.title', ctx)).toBe('p1')
    ;(ctx as unknown as Record<string, unknown>).$parent = { title: 'p2' }
    expect(evaluate('$parent.title', ctx)).toBe('p2')

    ;(ctx as unknown as Record<string, unknown>).$siblings = [{ id: 1 }]
    expect(evaluate('$siblings[0].id', ctx)).toBe(1)
    ;(ctx as unknown as Record<string, unknown>).$siblings = [{ id: 2 }]
    expect(evaluate('$siblings[0].id', ctx)).toBe(2)

    ;(ctx as unknown as Record<string, unknown>).$children = [{ name: 'c1' }]
    expect(evaluate('$children[0].name', ctx)).toBe('c1')
    ;(ctx as unknown as Record<string, unknown>).$children = [{ name: 'c2' }]
    expect(evaluate('$children[0].name', ctx)).toBe('c2')
  })
})

describe('命名空间变量仍可缓存', () => {
  it('$variables.x 可缓存且 invalidateCache("$variables") 失效', () => {
    const ctx = createRuntimeContext({})
    ;(ctx as unknown as Record<string, unknown>).$variables = { x: 1 }
    expect(evaluate('$variables.x', ctx)).toBe(1)
    // 重新赋值触发 proxy set → invalidateCache，或者直接失效
    ;(ctx as unknown as Record<string, unknown>).$variables = { x: 2 }
    invalidateCache('$variables', ctx)
    expect(evaluate('$variables.x', ctx)).toBe(2)
  })
})

describe('evaluateExpressionPlan 特殊变量不缓存', () => {
  it('$event 开头的 plan 不入 memo', () => {
    const ctx = createRuntimeContext({})
    const memo = new ResultMemo({ sessionId: 'test' })
    const plan = compileExpressionPlan('$event.target.value')
    ;(ctx as unknown as Record<string, unknown>).$event = { target: { value: 'first' } }
    expect(evaluateExpressionPlan(plan, ctx, { memo })).toBe('first')
    ;(ctx as unknown as Record<string, unknown>).$event = { target: { value: 'second' } }
    expect(evaluateExpressionPlan(plan, ctx, { memo })).toBe('second')
    expect(memo.stats().size).toBe(0)
  })

  it('$self 开头的 plan 不入 memo', () => {
    const ctx = createRuntimeContext({})
    const memo = new ResultMemo({ sessionId: 'test' })
    const plan = compileExpressionPlan('$self.props.label')
    ;(ctx as unknown as Record<string, unknown>).$self = { props: { label: 'L1' } }
    expect(evaluateExpressionPlan(plan, ctx, { memo })).toBe('L1')
    ;(ctx as unknown as Record<string, unknown>).$self = { props: { label: 'L2' } }
    expect(evaluateExpressionPlan(plan, ctx, { memo })).toBe('L2')
    expect(memo.stats().size).toBe(0)
  })

  it('$variables 命名空间依赖归入 stateDeps 参与版本', () => {
    const plan = compileExpressionPlan('$variables.x + 1')
    expect(plan.stateDeps).toContain('$variables.x')
    expect(plan.dynamicDeps ?? []).not.toContain('$variables.x')
  })
})
