/**
 * 表达式求值测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context'
import { evaluate } from '../../src/expression/evaluate'
import { registerBuiltinMethods } from '../../src/vm/handlers'

describe('表达式求值', () => {
  let ctx: ReturnType<typeof createRuntimeContext>
  
  beforeEach(() => {
    ctx = createRuntimeContext({
      user: { name: 'John', age: 30 },
      items: [1, 2, 3],
      count: 0
    })
    registerBuiltinMethods(ctx)
  })
  
  it('应该求值字面量', () => {
    expect(evaluate('123', ctx)).toBe(123)
    expect(evaluate('"hello"', ctx)).toBe('hello')
    expect(evaluate('true', ctx)).toBe(true)
  })
  
  it('应该求值标识符（直接属性访问）', () => {
    expect(evaluate('user.name', ctx)).toBe('John')
    expect(evaluate('user.age', ctx)).toBe(30)
    expect(evaluate('count', ctx)).toBe(0)
  })
  
  it('应该求值成员访问', () => {
    expect(evaluate('user.name', ctx)).toBe('John')
    expect(evaluate('items[0]', ctx)).toBe(1)
  })
  
  it('应该求值二元运算', () => {
    expect(evaluate('1 + 2', ctx)).toBe(3)
    expect(evaluate('user.age > 18', ctx)).toBe(true)
    expect(evaluate('user.age === 30', ctx)).toBe(true)
  })
  
  it('应该求值逻辑运算', () => {
    expect(evaluate('true && false', ctx)).toBe(false)
    expect(evaluate('true || false', ctx)).toBe(true)
    expect(evaluate('user.age > 18 && user.name === "John"', ctx)).toBe(true)
  })
  
  it('应该求值三元表达式', () => {
    expect(evaluate('user.age > 18 ? "adult" : "minor"', ctx)).toBe('adult')
  })
  
  it('应该求值空值合并', () => {
    expect(evaluate('user.name ?? "unknown"', ctx)).toBe('John')
    expect(evaluate('user.email ?? "no-email"', ctx)).toBe('no-email')
  })
  
  it('应该求值函数调用（白名单）', () => {
    expect(evaluate('Math.max(1, 2, 3)', ctx)).toBe(3)
    expect(evaluate('Array.isArray(items)', ctx)).toBe(true)
    expect(evaluate('String(user.age)', ctx)).toBe('30')
  })
  
  it('应该拒绝禁止的语法', () => {
    expect(() => evaluate('user.name = "Jane"', ctx)).toThrow()  // 赋值
    expect(() => evaluate('user.age++', ctx)).toThrow()  // 自增
    expect(() => evaluate('() => {}', ctx)).toThrow()  // 箭头函数
  })
  
  it('应该拒绝访问全局对象', () => {
    expect(() => evaluate('window', ctx)).toThrow()
    expect(() => evaluate('document', ctx)).toThrow()
  })

  it('默认应拒绝未白名单的全局函数调用', () => {
    ;(globalThis as any).__testFn = () => 42
    expect(() => evaluate('__testFn()', ctx)).toThrow()
    delete (globalThis as any).__testFn
  })

  it('开启 allowGlobals 时应允许任意全局函数调用', () => {
    ;(globalThis as any).__testFn = () => 42
    expect(evaluate('__testFn()', ctx, { allowGlobals: true })).toBe(42)
    delete (globalThis as any).__testFn
  })

  it('开启 allowGlobals 时允许访问全局对象属性', () => {
    ;(globalThis as any).__testVal = 7
    expect(() => evaluate('globalThis.__testVal', ctx)).toThrow()
    expect(evaluate('globalThis.__testVal', ctx, { allowGlobals: true })).toBe(7)
    delete (globalThis as any).__testVal
  })

  describe('危险属性访问防护', () => {
    it('应该拒绝访问 constructor 属性', () => {
      expect(() => evaluate('Object.constructor', ctx)).toThrow()
      expect(() => evaluate('user.constructor', ctx)).toThrow()
      expect(() => evaluate('items.constructor', ctx)).toThrow()
    })

    it('应该拒绝访问 prototype 属性', () => {
      expect(() => evaluate('Array.prototype', ctx)).toThrow()
      expect(() => evaluate('Object.prototype', ctx)).toThrow()
    })

    it('应该拒绝访问 __proto__ 属性', () => {
      expect(() => evaluate('user.__proto__', ctx)).toThrow()
      expect(() => evaluate('items.__proto__', ctx)).toThrow()
    })

    it('应该拒绝通过计算属性访问危险属性', () => {
      expect(() => evaluate('user["constructor"]', ctx)).toThrow()
      expect(() => evaluate('user["__proto__"]', ctx)).toThrow()
      expect(() => evaluate('Object["prototype"]', ctx)).toThrow()
    })

    it('开启 allowGlobals 时应允许访问危险属性', () => {
      expect(evaluate('Object.constructor', ctx, { allowGlobals: true })).toBe(Function)
      expect(evaluate('user.constructor', ctx, { allowGlobals: true })).toBe(Object)
    })
  })
})
