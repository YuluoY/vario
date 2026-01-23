/**
 * 表达式解析器测试
 */

import { describe, it, expect } from 'vitest'
import { parseExpression } from '../../src/expression/parser'
import { ExpressionError } from '../../src/types'

describe('表达式解析器', () => {
  it('应该解析简单表达式', () => {
    const ast = parseExpression('1 + 2')
    expect(ast).toBeDefined()
    expect(ast.type).toBe('BinaryExpression')
  })
  
  it('应该解析成员访问表达式', () => {
    const ast = parseExpression('user.name')
    expect(ast).toBeDefined()
    expect(ast.type).toBe('MemberExpression')
  })
  
  it('应该解析函数调用表达式', () => {
    const ast = parseExpression('Math.max(1, 2, 3)')
    expect(ast).toBeDefined()
    expect(ast.type).toBe('CallExpression')
  })
  
  it('应该解析三元表达式', () => {
    const ast = parseExpression('age > 18 ? "adult" : "minor"')
    expect(ast).toBeDefined()
    expect(ast.type).toBe('ConditionalExpression')
  })
  
  it('应该在解析失败时抛出错误', () => {
    expect(() => {
      parseExpression('invalid syntax {')
    }).toThrow()
  })
  
  it('应该解析逻辑表达式', () => {
    const ast = parseExpression('a && b || c')
    expect(ast).toBeDefined()
    expect(ast.type).toBe('LogicalExpression')
  })
  
  it('应该解析数组表达式', () => {
    const ast = parseExpression('[1, 2, 3]')
    expect(ast).toBeDefined()
    expect(ast.type).toBe('ArrayExpression')
  })
  
  it('应该解析对象表达式', () => {
    const ast = parseExpression('{ a: 1, b: 2 }')
    expect(ast).toBeDefined()
    expect(ast.type).toBe('ObjectExpression')
  })
})
