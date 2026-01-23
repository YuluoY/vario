/**
 * 数组操作动作测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createRuntimeContext } from '../../../src/runtime/create-context.js'
import { execute } from '../../../src/vm/executor.js'
import { ErrorCodes } from '../../../src/errors.js'

describe('数组操作动作', () => {
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    ctx = createRuntimeContext({
      items: [1, 2, 3],
      todos: []
    })
  })

  describe('push', () => {
    it('应该添加元素到数组末尾', async () => {
      await execute([
        { type: 'push', path: 'items', value: 4 }
      ], ctx)
      
      expect(ctx.items).toEqual([1, 2, 3, 4])
    })

    it('应该支持添加多个元素', async () => {
      await execute([
        { type: 'push', path: 'items', items: [4, 5] }
      ], ctx)
      
      expect(ctx.items).toEqual([1, 2, 3, 4, 5])
    })

    it('应该在路径不是数组时抛出错误', async () => {
      try {
        await execute([
          { type: 'push', path: 'items', value: 4 }
        ], createRuntimeContext({ items: 'not-array' }))
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.ACTION_INVALID_PARAM)
      }
    })
  })

  describe('pop', () => {
    it('应该删除数组末尾元素', async () => {
      await execute([
        { type: 'pop', path: 'items' }
      ], ctx)
      
      expect(ctx.items).toEqual([1, 2])
    })

    it('应该处理空数组', async () => {
      await execute([
        { type: 'pop', path: 'todos' }
      ], ctx)
      
      expect(ctx.todos).toEqual([])
    })
  })

  describe('shift', () => {
    it('应该删除数组首元素', async () => {
      await execute([
        { type: 'shift', path: 'items' }
      ], ctx)
      
      expect(ctx.items).toEqual([2, 3])
    })
  })

  describe('unshift', () => {
    it('应该添加元素到数组开头', async () => {
      await execute([
        { type: 'unshift', path: 'items', value: 0 }
      ], ctx)
      
      expect(ctx.items).toEqual([0, 1, 2, 3])
    })
  })

  describe('splice', () => {
    it('应该删除元素', async () => {
      await execute([
        { type: 'splice', path: 'items', start: 1, deleteCount: 1 }
      ], ctx)
      
      expect(ctx.items).toEqual([1, 3])
    })

    it('应该替换元素', async () => {
      await execute([
        { type: 'splice', path: 'items', start: 1, deleteCount: 1, items: [99] }
      ], ctx)
      
      expect(ctx.items).toEqual([1, 99, 3])
    })

    it('应该支持表达式参数', async () => {
      ctx.count = 1
      await execute([
        { type: 'splice', path: 'items', start: '{{ count }}', deleteCount: 1 }
      ], ctx)
      
      expect(ctx.items).toEqual([1, 3])
    })
  })
})
