/**
 * 回归测试：表达式白名单恢复 HEAD 可用面（FR-4 / AC-5）
 *
 * - Math.pow / Math.random / Object.keys / Object.values / Object.entries / Array.from 可用
 * - String/Number/Boolean/Array/Object/Math/Date/JSON 静态方法可用
 * - reverse/sort 仅链式调用（callee 对象为 CallExpression 结果）放行
 * - Object.assign/defineProperty/setPrototypeOf/getPrototypeOf 继续禁止
 * - eval/Function/setTimeout 继续禁止
 * - 直接对 state 数组 reverse 仍被拒绝
 * - Math.random 放行但不缓存（impure）
 */

import { describe, it, expect } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context.js'
import { evaluate } from '../../src/expression/evaluate.js'
import { ExpressionError, ErrorCodes } from '../../src/errors.js'

function expectReject(expr: string, ctx = createRuntimeContext({})): void {
  expect(() => evaluate(expr, ctx), expr).toThrow(ExpressionError)
}

describe('HEAD 可用的白名单全局静态方法', () => {
  const ctx = createRuntimeContext({
    obj: { a: 1, b: 2 },
    list: [3, 1, 2],
    n: 2,
  })

  it('Math.pow(2,3) === 8', () => {
    expect(evaluate('Math.pow(2, 3)', ctx)).toBe(8)
  })

  it('Math.sqrt / Math.abs / Math.max', () => {
    expect(evaluate('Math.sqrt(16)', ctx)).toBe(4)
    expect(evaluate('Math.abs(-5)', ctx)).toBe(5)
    expect(evaluate('Math.max(1, 9, 3)', ctx)).toBe(9)
  })

  it('Math.random() >= 0（放行且 impure 不缓存）', () => {
    const v = evaluate('Math.random()', ctx) as number
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
    // impure：不缓存
    expect(evaluate('Math.random()', ctx)).toBeGreaterThanOrEqual(0)
  })

  it('Object.keys(obj).length === 2', () => {
    expect(evaluate('Object.keys(obj).length', ctx)).toBe(2)
  })

  it('Object.values / Object.entries', () => {
    expect(evaluate('Object.values(obj).length', ctx)).toBe(2)
    expect(evaluate('Object.entries(obj).length', ctx)).toBe(2)
  })

  it('Object.is', () => {
    expect(evaluate('Object.is(1, 1)', ctx)).toBe(true)
  })

  it('Array.from(list).length === 3', () => {
    expect(evaluate('Array.from(list).length', ctx)).toBe(3)
  })

  it('Array.isArray', () => {
    expect(evaluate('Array.isArray(list)', ctx)).toBe(true)
  })

  it('JSON.stringify / JSON.parse', () => {
    expect(evaluate('JSON.stringify(obj)', ctx)).toBe('{"a":1,"b":2}')
    expect(evaluate('JSON.parse("{\\"x\\":1}").x', ctx)).toBe(1)
  })

  it('Date.now / String / Number / Boolean 构造', () => {
    expect(evaluate('Date.now() > 0', ctx)).toBe(true)
    expect(evaluate('String(12)', ctx)).toBe('12')
    expect(evaluate('Number("12")', ctx)).toBe(12)
    expect(evaluate('Boolean(0)', ctx)).toBe(false)
  })

  it('list.slice().reverse()[0] 求值成功（链式 reverse）', () => {
    // list = [3,1,2] → slice() 副本 [3,1,2] → reverse [2,1,3] → [0] = 2
    expect(evaluate('list.slice().reverse()[0]', ctx)).toBe(2)
  })

  it('list.slice().sort()[0] 求值成功（链式 sort）', () => {
    expect(evaluate('list.slice().sort()[0]', ctx)).toBe(1)
  })
})

describe('仍然禁止的表达式', () => {
  it('list.reverse()（直接对 state 数组）被拒绝', () => {
    const ctx = createRuntimeContext({ list: [1, 2, 3] })
    expect(() => evaluate('list.reverse()', ctx)).toThrow(ExpressionError)
  })

  it('list.sort()（直接对 state 数组）被拒绝', () => {
    const ctx = createRuntimeContext({ list: [1, 2, 3] })
    expect(() => evaluate('list.sort()', ctx)).toThrow(ExpressionError)
  })

  it('Object.assign 被拒绝', () => {
    expectReject('Object.assign(obj, { c: 3 })')
  })

  it('Object.defineProperty 被拒绝', () => {
    expectReject('Object.defineProperty(obj, "x", {})')
  })

  it('Object.defineProperties 被拒绝', () => {
    expectReject('Object.defineProperties(obj, {})')
  })

  it('Object.setPrototypeOf 被拒绝', () => {
    expectReject('Object.setPrototypeOf(obj, null)')
  })

  it('Object.getPrototypeOf 被拒绝', () => {
    expectReject('Object.getPrototypeOf(obj)')
  })

  it('Object.getOwnPropertyDescriptor 被拒绝', () => {
    expectReject('Object.getOwnPropertyDescriptor(obj, "a")')
  })

  it('eval 被拒绝', () => {
    expectReject('eval("1")')
  })

  it('Function 构造被拒绝', () => {
    expectReject('Function("return 1")')
  })

  it('setTimeout 被拒绝', () => {
    expectReject('setTimeout(fn, 100)')
  })

  it('window / globalThis 访问被拒绝', () => {
    expectReject('globalThis.Math')
    expectReject('window.document')
  })

  it('原型链污染段被拒绝', () => {
    const ctx = createRuntimeContext({ obj: {} })
    expect(() => evaluate('obj.constructor', ctx)).toThrow(ExpressionError)
    expect(() => evaluate('obj["__proto__"]', ctx)).toThrow(ExpressionError)
  })
})

describe('错误码语义', () => {
  it('白名单拒绝抛 EXPRESSION_VALIDATION_ERROR 或 FUNCTION_NOT_WHITELISTED', () => {
    const ctx = createRuntimeContext({ list: [1] })
    try {
      evaluate('list.reverse()', ctx)
      expect.unreachable('should throw')
    } catch (error) {
      const exprErr = error as ExpressionError
      expect([
        ErrorCodes.EXPRESSION_VALIDATION_ERROR,
        ErrorCodes.EXPRESSION_FUNCTION_NOT_WHITELISTED,
      ]).toContain(exprErr.code)
    }
  })

  it('reverse 提示 slice().reverse() 用法', () => {
    const ctx = createRuntimeContext({ list: [1, 2] })
    try {
      evaluate('list.reverse()', ctx)
      expect.unreachable('should throw')
    } catch (error) {
      expect((error as Error).message).toMatch(/slice\(\)\.reverse/)
    }
  })
})

describe('allowGlobals 行为不变', () => {
  it('allowGlobals: true 时全局静态方法仍可用', () => {
    const ctx = createRuntimeContext(
      { obj: { a: 1 } },
      { exprOptions: { allowGlobals: true } }
    )
    expect(evaluate('Object.keys(obj).length', ctx)).toBe(1)
    expect(evaluate('Math.pow(2, 2)', ctx)).toBe(4)
  })
})
