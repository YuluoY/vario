import { describe, expect, it } from 'vitest'
import { ResultMemo } from '../../src/expression/result-memo.js'

describe('T1.6 ResultMemo', () => {
  it('caches null/false/0 as hits; undefined 不入 memo（FR-2 cacheable 规则）', () => {
    const memo = new ResultMemo({ sessionId: 's1' })
    for (const [id, value] of [['n', null], ['f', false], ['z', 0]] as const) {
      expect(memo.lookup(id, []).hit).toBe(false)
      memo.store(id, [], value)
      const looked = memo.lookup(id, [])
      expect(looked.hit).toBe(true)
      if (looked.hit) expect(looked.value).toBe(value)
    }
    memo.store('u', [], undefined)
    expect(memo.lookup('u', []).hit).toBe(false)
  })

  it('does not share results across sessions or generations', () => {
    const a = new ResultMemo({ sessionId: 'a' })
    const b = new ResultMemo({ sessionId: 'b' })
    a.store('p', ['x'], 1)
    expect(b.lookup('p', ['x']).hit).toBe(false)
    a.nextGeneration()
    expect(a.lookup('p', []).hit).toBe(false)
  })

  it('99/100/101 unique keys have no full-clear cliff', () => {
    const memo = new ResultMemo({ sessionId: 's', maxSize: 2000 })
    for (let i = 0; i < 101; i++) memo.store(`e${i}`, [], i)
    expect(memo.lookup('e0', []).hit).toBe(true)
    expect(memo.stats().size).toBe(101)
  })

  it('emits expression-miss/hit/evict to the diagnostic sink', () => {
    const names: string[] = []
    const memo = new ResultMemo({
      sessionId: 's',
      maxSize: 1,
      sink: { emit(event) { names.push(event.name) } }
    })
    expect(memo.lookup('a', []).hit).toBe(false)
    memo.store('a', [], 1)
    expect(memo.lookup('a', []).hit).toBe(true)
    memo.store('b', [], 2)
    expect(names).toContain('expression-miss')
    expect(names).toContain('expression-hit')
    expect(names).toContain('expression-evict')
    expect(names).toContain('expression-evaluate')
  })

  it('emits expression-error when plan evaluation throws', async () => {
    const { evaluateExpressionPlan } = await import('../../src/expression/plan-evaluator.js')
    const { compileExpressionPlan } = await import('../../src/expression/plan-compiler.js')
    const { createRuntimeContext } = await import('../../src/runtime/create-context.js')
    const names: string[] = []
    const memo = new ResultMemo({
      sessionId: 's',
      sink: { emit(event) { names.push(event.name) } }
    })
    const ctx = createRuntimeContext({})
    Object.defineProperty(ctx, 'boom', {
      get() { throw new Error('eval boom') },
      enumerable: true
    })
    expect(() => evaluateExpressionPlan(compileExpressionPlan('boom'), ctx, { memo })).toThrow()
    expect(names).toContain('expression-error')
  })
})
