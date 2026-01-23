/**
 * 表达式编译器测试
 */

import { describe, it, expect } from 'vitest'
import { parseExpression } from '../../src/expression/parser.js'
import {
  compileSimpleExpression,
  getCompiledExpression,
  clearCompiledCache
} from '../../src/expression/compiler.js'
import { createRuntimeContext } from '../../src/runtime/create-context.js'

describe('表达式编译器', () => {
  beforeEach(() => {
    clearCompiledCache()
  })

  describe('compileSimpleExpression', () => {
    it('应该编译字面量表达式', () => {
      const ast = parseExpression('42')
      const compiled = compileSimpleExpression(ast)
      
      expect(compiled).not.toBeNull()
      const ctx = createRuntimeContext()
      expect(compiled!(ctx)).toBe(42)
    })

    it('应该编译字符串字面量', () => {
      const ast = parseExpression('"hello"')
      const compiled = compileSimpleExpression(ast)
      
      expect(compiled).not.toBeNull()
      const ctx = createRuntimeContext()
      expect(compiled!(ctx)).toBe('hello')
    })

    it('应该编译标识符表达式', () => {
      const ast = parseExpression('user')
      const compiled = compileSimpleExpression(ast)
      
      expect(compiled).not.toBeNull()
      const ctx = createRuntimeContext({ user: { name: 'John' } })
      expect(compiled!(ctx)).toEqual({ name: 'John' })
    })

    it('应该编译静态成员访问', () => {
      const ast = parseExpression('user.name')
      const compiled = compileSimpleExpression(ast)
      
      expect(compiled).not.toBeNull()
      const ctx = createRuntimeContext({ user: { name: 'John' } })
      expect(compiled!(ctx)).toBe('John')
    })

    it('应该编译嵌套成员访问', () => {
      const ast = parseExpression('user.profile.avatar')
      const compiled = compileSimpleExpression(ast)
      
      expect(compiled).not.toBeNull()
      const ctx = createRuntimeContext({
        user: { profile: { avatar: 'url' } }
      })
      expect(compiled!(ctx)).toBe('url')
    })

    it('应该编译数组索引访问', () => {
      // 使用方括号语法，因为 items.0 在 JavaScript 中不是有效的属性访问
      const ast = parseExpression('items[0]')
      const compiled = compileSimpleExpression(ast)
      
      expect(compiled).not.toBeNull()
      const ctx = createRuntimeContext({ items: ['a', 'b', 'c'] })
      expect(compiled!(ctx)).toBe('a')
    })

    it('应该拒绝编译复杂表达式', () => {
      const ast = parseExpression('user.name + 1')
      const compiled = compileSimpleExpression(ast)
      
      expect(compiled).toBeNull()
    })

    it('应该拒绝编译函数调用', () => {
      const ast = parseExpression('Math.max(1, 2)')
      const compiled = compileSimpleExpression(ast)
      
      expect(compiled).toBeNull()
    })
  })

  describe('getCompiledExpression', () => {
    it('应该缓存编译结果', () => {
      const expr = 'user.name'
      const ast = parseExpression(expr)
      
      const compiled1 = getCompiledExpression(expr, ast)
      const compiled2 = getCompiledExpression(expr, ast)
      
      expect(compiled1).toBe(compiled2)
    })

    it('应该为无法编译的表达式返回 null', () => {
      const expr = 'user.name + 1'
      const ast = parseExpression(expr)
      
      const compiled = getCompiledExpression(expr, ast)
      expect(compiled).toBeNull()
    })
  })
})
