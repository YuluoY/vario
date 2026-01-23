/**
 * 表达式缓存系统测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context'
import { evaluate } from '../../src/expression/evaluate'
import {
  getCachedExpression,
  setCachedExpression,
  invalidateCache,
  clearCache
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
    for (let i = 0; i < 110; i++) {
      const expr = `test.${i}`
      setCachedExpression(expr, i, [], ctx)
    }
    
    // 最旧的缓存应该被淘汰
    const oldest = getCachedExpression('test.0', ctx)
    expect(oldest).toBeNull()
    
    // 最新的缓存应该存在
    const newest = getCachedExpression('test.109', ctx)
    expect(newest).toBe(109)
  })
})
