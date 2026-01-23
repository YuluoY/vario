/**
 * Action VM 超时和步数限制测试
 */

import { describe, it, expect, vi } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context.js'
import { execute, type ExecuteOptions } from '../../src/vm/executor.js'
import { ErrorCodes } from '../../src/errors.js'

describe('Action VM 超时和步数限制', () => {
  describe('超时保护', () => {
    it('应该在超时时抛出错误', async () => {
      const ctx = createRuntimeContext({})
      
      // 注册一个会延迟的动作
      ctx.$methods['slow'] = async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const options: ExecuteOptions = {
        timeout: 50
      }
      
      try {
        await execute([{ type: 'slow' }], ctx, options)
        expect.fail('Should have thrown timeout error')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.ACTION_TIMEOUT)
      }
    })

    it('应该允许正常执行在超时范围内', async () => {
      const ctx = createRuntimeContext({ count: 0 })
      
      const options: ExecuteOptions = {
        timeout: 1000
      }
      
      await execute([
        { type: 'set', path: 'count', value: 10 }
      ], ctx, options)
      
      expect(ctx.count).toBe(10)
    })
  })

  describe('步数限制', () => {
    it('应该在超过最大步数时抛出错误', async () => {
      const ctx = createRuntimeContext({ count: 0 })
      
      const options: ExecuteOptions = {
        maxSteps: 5
      }
      
      // 创建超过步数限制的动作序列
      const actions = Array.from({ length: 10 }, () => ({
        type: 'set' as const,
        path: 'count',
        value: 1
      }))
      
      try {
        await execute(actions, ctx, options)
        expect.fail('Should have thrown max steps error')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.ACTION_MAX_STEPS_EXCEEDED)
      }
    })

    it('应该允许正常执行在步数限制内', async () => {
      const ctx = createRuntimeContext({ count: 0 })
      
      const options: ExecuteOptions = {
        maxSteps: 100
      }
      
      await execute([
        { type: 'set', path: 'count', value: 10 }
      ], ctx, options)
      
      expect(ctx.count).toBe(10)
    })
  })

  describe('边界条件', () => {
    it('应该处理空动作数组', async () => {
      const ctx = createRuntimeContext({})
      
      await execute([], ctx)
      
      // 应该正常完成，不抛出错误
      expect(true).toBe(true)
    })

    it('应该处理单个动作', async () => {
      const ctx = createRuntimeContext({ count: 0 })
      
      await execute([
        { type: 'set', path: 'count', value: 1 }
      ], ctx)
      
      expect(ctx.count).toBe(1)
    })

    it('应该正确处理动作执行中的错误', async () => {
      const ctx = createRuntimeContext({})
      
      ctx.$methods['error'] = async () => {
        throw new Error('Test error')
      }
      
      await expect(
        execute([{ type: 'error' }], ctx)
      ).rejects.toThrow('Test error')
    })
  })
})
