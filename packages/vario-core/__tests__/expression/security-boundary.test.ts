/**
 * 表达式安全边界测试
 * 
 * 覆盖场景：
 * - ctx 上下文污染攻击
 * - in 操作符类型守卫
 * - 路径深度限制
 * - 超时保护
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context'
import { evaluate } from '../../src/expression/evaluate'
import { setPathValue } from '../../src/runtime/path'
import { execute } from '../../src/vm/executor'
import { registerBuiltinMethods } from '../../src/vm/handlers'
import type { RuntimeContext, Action } from '@variojs/types'

describe('表达式安全边界', () => {
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    ctx = createRuntimeContext({
      user: { name: 'John', age: 30 },
      items: [1, 2, 3],
      list: { a: 1, b: 2 },
    })
    registerBuiltinMethods(ctx)
  })

  describe('ctx 上下文污染防护', () => {
    it('不应该通过表达式访问 constructor', () => {
      expect(() => evaluate('user.constructor', ctx)).toThrow()
    })

    it('不应该访问 __proto__', () => {
      expect(() => evaluate('user.__proto__', ctx)).toThrow()
    })

    it('不应该通过表达式调用非白名单函数', () => {
      // 尝试通过 ctx 调用 eval
      ;(ctx as any).eval = eval
      expect(() => evaluate('eval("1+1")', ctx)).toThrow()
    })

    it('不应该访问 prototype 属性', () => {
      expect(() => evaluate('user.prototype', ctx)).toThrow()
    })
  })

  describe('in 操作符类型守卫', () => {
    it('正常使用：对象中检查属性', () => {
      expect(evaluate('"a" in list', ctx)).toBe(true)
      expect(evaluate('"c" in list', ctx)).toBe(false)
    })

    it('应该拒绝右操作数为 null', () => {
      ;(ctx as any).nullVal = null
      expect(() => evaluate('"a" in nullVal', ctx)).toThrow(/object/)
    })

    it('应该拒绝右操作数为 undefined', () => {
      ;(ctx as any).undefVal = undefined
      expect(() => evaluate('"a" in undefVal', ctx)).toThrow(/object/)
    })

    it('应该拒绝右操作数为原始类型', () => {
      ;(ctx as any).numVal = 42
      expect(() => evaluate('"a" in numVal', ctx)).toThrow(/object/)
    })

    it('应该允许右操作数为数组', () => {
      expect(evaluate('0 in items', ctx)).toBe(true)
    })
  })

  describe('路径深度限制', () => {
    it('应该接受正常深度的路径', () => {
      const obj: Record<string, unknown> = {}
      const result = setPathValue(obj, 'a.b.c.d.e', 'ok')
      expect(result).toBe(true)
      expect((obj as any).a.b.c.d.e).toBe('ok')
    })

    it('应该拒绝超过 MAX_PATH_DEPTH(20) 的路径', () => {
      const obj: Record<string, unknown> = {}
      // 构造 21 层深度的路径
      const deepPath = Array.from({ length: 21 }, (_, i) => `k${i}`).join('.')
      const result = setPathValue(obj, deepPath, 'evil')
      expect(result).toBe(false)
    })

    it('20 层深度应该仍可设置', () => {
      const obj: Record<string, unknown> = {}
      const maxPath = Array.from({ length: 20 }, (_, i) => `k${i}`).join('.')
      const result = setPathValue(obj, maxPath, 'ok')
      expect(result).toBe(true)
    })
  })

  describe('VM 执行超时保护', () => {
    it('应该在超时后中断执行', async () => {
      const ctx = createRuntimeContext({}) as RuntimeContext
      registerBuiltinMethods(ctx)

      // 注册一个会长时间等待的方法
      ctx.$methods['slowAction'] = async () => {
        await new Promise(resolve => setTimeout(resolve, 10000))
      }

      const actions: Action[] = [{ type: 'slowAction' } as Action]

      await expect(
        execute(actions, ctx, { timeout: 100 })
      ).rejects.toThrow(/timeout/i)
    })

    it('应该在超过最大步数后中断', async () => {
      const ctx = createRuntimeContext({}) as RuntimeContext
      registerBuiltinMethods(ctx)

      // 创建大量动作
      const actions: Action[] = Array.from(
        { length: 50 },
        () => ({ type: 'set', path: 'x', value: 1 } as Action)
      )

      await expect(
        execute(actions, ctx, { maxSteps: 10 })
      ).rejects.toThrow(/steps/i)
    })
  })
})
