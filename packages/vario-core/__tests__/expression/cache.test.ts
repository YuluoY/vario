/**
 * 表达式缓存系统测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { performance } from 'node:perf_hooks'
import { createRuntimeContext } from '../../src/runtime/create-context'
import { evaluate } from '../../src/expression/evaluate'
import {
  getCachedExpression,
  setCachedExpression,
  lookupCachedExpression,
  invalidateCache,
  clearCache,
  getCacheStats
} from '../../src/expression/cache'
import { registerBuiltinMethods } from '../../src/vm/handlers'

describe('表达式缓存系统', () => {
  let ctx: ReturnType<typeof createRuntimeContext>
  
  beforeEach(() => {
    ctx = createRuntimeContext({
      user: { name: 'John', age: 30 },
      items: [1, 2, 3],
      count: 0
    })
    registerBuiltinMethods(ctx)
  })
  
  it('应该缓存表达式结果', () => {
    const expr = 'user.age + 10'
    const result = evaluate(expr, ctx)
    
    // 第二次求值应该使用缓存
    const cached = getCachedExpression(expr, ctx)
    expect(cached).toBe(result)
    expect(cached).toBe(40)
  })
  
  it('应该手动设置缓存', () => {
    const expr = 'test.expression'
    const result = 123
    const dependencies = ['user.name']
    
    setCachedExpression(expr, result, dependencies, ctx)
    
    const cached = getCachedExpression(expr, ctx)
    expect(cached).toBe(123)
  })
  
  it('应该在依赖变化时使缓存失效', () => {
    const expr = 'user.name'
    const result1 = evaluate(expr, ctx)
    expect(result1).toBe('John')
    
    // 验证缓存存在
    const cached1 = getCachedExpression(expr, ctx)
    expect(cached1).toBe('John')
    
    // 修改依赖的状态
    ctx._set('user.name', 'Jane')
    invalidateCache('user.name', ctx)
    
    // 缓存应该失效
    const cached2 = getCachedExpression(expr, ctx)
    expect(cached2).toBeNull()
  })
  
  it('应该支持通配符依赖失效', () => {
    const expr = 'items[0]'
    evaluate(expr, ctx)  // 创建缓存，依赖 items.*
    
    // 验证缓存存在
    const cached1 = getCachedExpression(expr, ctx)
    expect(cached1).toBe(1)
    
    // 修改数组元素
    ctx._set('items.0', 999)
    invalidateCache('items.0', ctx)
    
    // 缓存应该失效
    const cached2 = getCachedExpression(expr, ctx)
    expect(cached2).toBeNull()
  })
  
  it('应该清除所有缓存', () => {
    const expr1 = 'user.name'
    const expr2 = 'user.age'
    
    evaluate(expr1, ctx)
    evaluate(expr2, ctx)
    
    // 验证缓存存在
    expect(getCachedExpression(expr1, ctx)).not.toBeNull()
    expect(getCachedExpression(expr2, ctx)).not.toBeNull()
    
    // 清除所有缓存
    clearCache(ctx)
    
    // 缓存应该都被清除
    expect(getCachedExpression(expr1, ctx)).toBeNull()
    expect(getCachedExpression(expr2, ctx)).toBeNull()
  })
  
  it('应该在缓存已满时使用 LRU 淘汰', () => {
    // 创建超过 MAX_CACHE_SIZE (100) 的缓存
    for (let i = 0; i < 2010; i++) {
      const expr = `test.${i}`
      setCachedExpression(expr, i, [], ctx)
    }

    const oldest = getCachedExpression('test.0', ctx)
    expect(oldest).toBeNull()

    const newest = getCachedExpression('test.2009', ctx)
    expect(newest).toBe(2009)
  })

  it('EXPR-1 distinguishes null/undefined/false/0 hits', () => {
    setCachedExpression('n', null, [], ctx)
    setCachedExpression('u', undefined, [], ctx)
    setCachedExpression('f', false, [], ctx)
    setCachedExpression('z', 0, [], ctx)
    expect(lookupCachedExpression('n', ctx)).toEqual({ hit: true, value: null })
    expect(lookupCachedExpression('u', ctx)).toEqual({ hit: true, value: undefined })
    expect(lookupCachedExpression('f', ctx)).toEqual({ hit: true, value: false })
    expect(lookupCachedExpression('z', ctx)).toEqual({ hit: true, value: 0 })
  })

  it('OBS-4 getCacheStats reports hit/miss/evict', () => {
    expect(lookupCachedExpression('missing', ctx).hit).toBe(false)
    setCachedExpression('n', 1, ['n'], ctx)
    expect(lookupCachedExpression('n', ctx).hit).toBe(true)
    const stats = getCacheStats(ctx)
    expect(stats.hits).toBeGreaterThanOrEqual(1)
    expect(stats.misses).toBeGreaterThanOrEqual(1)
    expect(stats.size).toBeGreaterThanOrEqual(1)
  })
})

import { ResultMemo } from '../../src/expression/result-memo'
import { compileExpressionPlan } from '../../src/expression/plan-compiler'
import { createScopeFrame, lookupBinding, type ScopeTable } from '../../src/scope/scope-frame'
import { subscribeChangeSet, beginChangeTransaction, endChangeTransaction, recordChange } from '../../src/runtime/change-set'
import { registerCapability, getCapability } from '../../src/expression/policy'
import { execute } from '../../src/vm/executor'
import { RuntimeSession } from '../../src/runtime/runtime-session'

describe('T1.6 ResultMemo', () => {
  it('hits null/false/0 (undefined 不入 memo) and evicts one at 101/2000 without full clear', () => {
    const memo = new ResultMemo({ sessionId: 's1', maxSize: 100 })
    for (const [id, value] of [['a', null], ['c', false], ['d', 0]] as const) {
      memo.store(id, [], value)
      expect(memo.lookup(id, [])).toEqual({ hit: true, value })
    }
    memo.store('b', [], undefined)
    expect(memo.lookup('b', []).hit).toBe(false)
    const bounded = new ResultMemo({ sessionId: 's2', maxSize: 100 })
    for (let i = 0; i < 101; i++) bounded.store(`p${i}`, [], i)
    const stats = bounded.stats()
    expect(stats.size).toBe(100)
    expect(stats.evicts).toBe(1)
    expect(bounded.lookup('p0', []).hit).toBe(false)
    expect(bounded.lookup('p100', []).hit).toBe(true)
  })

  it('does not share results across sessions or policy fingerprints', () => {
    const a = new ResultMemo({ sessionId: 'a', policyFingerprint: 'p1' })
    const b = new ResultMemo({ sessionId: 'b', policyFingerprint: 'p1' })
    a.store('plan', ['x'], 1)
    expect(b.lookup('plan', ['x']).hit).toBe(false)
    const c = new ResultMemo({ sessionId: 'a', policyFingerprint: 'p2' })
    expect(c.lookup('plan', ['x']).hit).toBe(false)
  })

  it('invalidates when dependency version bumps', () => {
    const memo = new ResultMemo({ sessionId: 's' })
    memo.store('plan', ['label'], 'old')
    expect(memo.lookup('plan', ['label']).value).toBe('old')
    memo.bump('label')
    expect(memo.lookup('plan', ['label']).hit).toBe(false)
  })
})

describe('T1.5 ExpressionPlan', () => {
  it('is frozen and splits state/local deps', () => {
    const plan = compileExpressionPlan('item.label + count')
    expect(Object.isFrozen(plan)).toBe(true)
    expect(plan.localDeps.some(d => d.startsWith('item'))).toBe(true)
    expect(plan.stateDeps.includes('count')).toBe(true)
    expect(plan.policyFingerprint.length).toBeGreaterThan(0)
  })
})

describe('T3.1 ScopeFrame', () => {
  it('looks up local then parent without Object.create', () => {
    const table: ScopeTable = new Map()
    const parent = createScopeFrame(null, { item: 'parent' })
    const child = createScopeFrame(parent, { item: 'child' })
    table.set(parent.id, parent)
    table.set(child.id, child)
    expect(lookupBinding(table, child, 'item')).toEqual({ found: true, value: 'child' })
    expect(Object.getPrototypeOf(child)).toBe(Object.prototype)
  })
})

describe('STATE-3 ChangeSet batch', () => {
  it('batches N writes into one notification', () => {
    const owner = {}
    const sets: number[] = []
    subscribeChangeSet(owner, cs => sets.push(cs.records.length))
    beginChangeTransaction(owner)
    recordChange(owner, 'a', 1)
    recordChange(owner, 'b', 2)
    endChangeTransaction(owner)
    expect(sets).toEqual([2])
  })
})

describe('STATE-2/4 write channels', () => {
  it('direct proxy assignment produces ChangeSet and invalidates cache', () => {
    const ctx = createRuntimeContext({ n: 1 })
    setCachedExpression('n', 1, ['n'], ctx)
    const paths: string[][] = []
    subscribeChangeSet(ctx, cs => paths.push([...cs.paths]))
    ;(ctx as { n: number }).n = 2
    expect((ctx as { n: number }).n).toBe(2)
    expect(paths).toEqual([['n']])
    expect(lookupCachedExpression('n', ctx).hit).toBe(false)
  })

  it('adapter setProperty produces the same ChangeSet path', () => {
    const store: Record<string, unknown> = { n: 1 }
    const adapter = {
      get(path: string) { return store[path] },
      set(path: string, value: unknown) { store[path] = value },
      getProperty(key: string) { return store[key] },
      setProperty(key: string, value: unknown) { store[key] = value },
      has(key: string) { return key in store },
      keys() { return Object.keys(store) }
    }
    const ctx = createRuntimeContext({}, { adapter })
    const paths: string[][] = []
    subscribeChangeSet(ctx, cs => paths.push([...cs.paths]))
    ;(ctx as { n: number }).n = 9
    expect(store.n).toBe(9)
    expect(paths).toEqual([['n']])
  })

  it('VM set and array push produce ChangeSet via _set', async () => {
    const ctx = createRuntimeContext({ items: [1], n: 0 })
    const paths: string[][] = []
    subscribeChangeSet(ctx, cs => paths.push([...cs.paths]))
    await execute([{ type: 'set', path: 'n', value: 1 }], ctx)
    await execute([{ type: 'push', path: 'items', value: 2 }], ctx)
    expect(paths).toEqual([['n'], ['items']])
  })
})

describe('SEC-8 capability registry', () => {
  it('requires explicit registration', () => {
    registerCapability({
      name: '$utils.ping',
      pure: true,
      cost: 1,
      inputLimit: 8,
      allowInExpression: true,
      impl: () => 'ok'
    })
    expect(getCapability('$utils.ping')?.allowInExpression).toBe(true)
    const ctx = createRuntimeContext({})
    expect(evaluate('$utils.ping()', ctx)).toBe('ok')
  })

  it('rejects unregistered, forbidden, impure-disallowed, and over-limit calls', () => {
    const ctx = createRuntimeContext({})
    ;(ctx as Record<string, unknown>).$utils = {
      double: (x: number) => x * 2,
      constructor: () => 'nope'
    }
    expect(() => evaluate('$utils.double(1)', ctx)).toThrow()
    expect(() => evaluate('$utils.constructor()', ctx)).toThrow()
    registerCapability({
      name: '$utils.blocked',
      pure: true,
      cost: 1,
      inputLimit: 1,
      allowInExpression: false,
      impl: () => 'no'
    })
    expect(() => evaluate('$utils.blocked()', ctx)).toThrow()
    registerCapability({
      name: '$utils.once',
      pure: true,
      cost: 1,
      inputLimit: 1,
      allowInExpression: true,
      impl: (x: unknown) => x
    })
    expect(evaluate('$utils.once(1)', ctx)).toBe(1)
    expect(() => evaluate('$utils.once(1, 2)', ctx)).toThrow(/inputLimit/)
  })

  it('SSR-1 engine overlays do not share capabilities', () => {
    registerCapability({
      name: '$utils.mark',
      pure: true,
      cost: 1,
      inputLimit: 0,
      allowInExpression: true,
      impl: () => 'A'
    }, { engineId: 'cap-a' })
    registerCapability({
      name: '$utils.mark',
      pure: true,
      cost: 1,
      inputLimit: 0,
      allowInExpression: true,
      impl: () => 'B'
    }, { engineId: 'cap-b' })
    const ctxA = createRuntimeContext({})
    const ctxB = createRuntimeContext({})
    const ctxC = createRuntimeContext({})
    const sessionA = new RuntimeSession(ctxA, { engineId: 'cap-a' })
    const sessionB = new RuntimeSession(ctxB, { engineId: 'cap-b' })
    expect(evaluate('$utils.mark()', ctxA)).toBe('A')
    expect(evaluate('$utils.mark()', ctxB)).toBe('B')
    expect(() => evaluate('$utils.mark()', ctxC)).toThrow()
    sessionA.dispose()
    sessionB.dispose()
  })
})

describe('T1.9 plan-performance EXPR-4 / PERF-A4', () => {
  it('101 unique plans stay bounded without full-clear', () => {
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
