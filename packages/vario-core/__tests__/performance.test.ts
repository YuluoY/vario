/**
 * Vario Core 性能压力测试
 * 
 * 测试场景：
 * - 路径解析性能（大量路径操作）
 * - 表达式求值性能（复杂表达式）
 * - 缓存系统性能（命中率、失效速度）
 * - 上下文创建性能（大量实例）
 * - 指令执行性能（批量指令）
 */

import { describe, it, expect } from 'vitest'
import { 
  createRuntimeContext,
  evaluate,
  execute,
  parsePath,
  getPathValue,
  setPathValue
} from '../src/index.js'
import type { RuntimeContext } from '../src/types.js'

describe('Vario Core 性能压力测试', () => {
  describe('路径解析性能', () => {
    it('应该能快速解析 10000 个路径', () => {
      const startTime = performance.now()
      
      const paths = Array.from({ length: 10000 }, (_, i) => 
        `user.${i}.profile.name`
      )
      
      for (const path of paths) {
        parsePath(path)
      }
      
      const endTime = performance.now()
      const parseTime = endTime - startTime

      expect(parseTime).toBeLessThan(100) // 应该在 100ms 内完成
      console.log(`✓ 10000 个路径解析耗时: ${parseTime.toFixed(2)}ms`)
    })

    it('应该能快速处理深度路径', () => {
      const startTime = performance.now()
      
      // 创建 20 层深度路径
      const deepPath = Array.from({ length: 20 }, (_, i) => `level${i}`).join('.')
      
      for (let i = 0; i < 1000; i++) {
        parsePath(deepPath)
      }
      
      const endTime = performance.now()
      const parseTime = endTime - startTime

      expect(parseTime).toBeLessThan(50)
      console.log(`✓ 1000 个深度路径解析耗时: ${parseTime.toFixed(2)}ms`)
    })
  })

  describe('路径操作性能', () => {
    it('应该能快速读取 10000 个路径值', () => {
      const obj: Record<string, unknown> = {
        user: {
          profile: {
            name: 'Test',
            age: 30
          }
        }
      }
      
      const startTime = performance.now()
      
      for (let i = 0; i < 10000; i++) {
        getPathValue(obj, 'user.profile.name')
        getPathValue(obj, 'user.profile.age')
      }
      
      const endTime = performance.now()
      const readTime = endTime - startTime

      expect(readTime).toBeLessThan(200)
      console.log(`✓ 10000 次路径读取耗时: ${readTime.toFixed(2)}ms`)
    })

    it('应该能快速设置 10000 个路径值', () => {
      const obj: Record<string, unknown> = {}
      
      const startTime = performance.now()
      
      for (let i = 0; i < 10000; i++) {
        setPathValue(obj, `user.${i}.name`, `User ${i}`)
      }
      
      const endTime = performance.now()
      const writeTime = endTime - startTime

      expect(writeTime).toBeLessThan(500)
      console.log(`✓ 10000 次路径写入耗时: ${writeTime.toFixed(2)}ms`)
    })

    it('应该能快速处理数组路径', () => {
      const obj: Record<string, unknown> = {
        items: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: i * 2 }))
      }
      
      const startTime = performance.now()
      
      for (let i = 0; i < 1000; i++) {
        getPathValue(obj, `items.${i}.value`)
        setPathValue(obj, `items.${i}.value`, i * 3)
      }
      
      const endTime = performance.now()
      const arrayTime = endTime - startTime

      expect(arrayTime).toBeLessThan(300)
      console.log(`✓ 1000 次数组路径操作耗时: ${arrayTime.toFixed(2)}ms`)
    })
  })

  describe('表达式求值性能', () => {
    it('应该能快速求值 1000 个简单表达式', () => {
      const ctx = createRuntimeContext({
        a: 10,
        b: 20,
        c: 30
      })
      
      const startTime = performance.now()
      
      for (let i = 0; i < 1000; i++) {
        evaluate('a + b + c', ctx)
        evaluate('a * b - c', ctx)
        evaluate('(a + b) * c', ctx)
      }
      
      const endTime = performance.now()
      const evalTime = endTime - startTime

      expect(evalTime).toBeLessThan(1000)
      console.log(`✓ 1000 个表达式求值耗时: ${evalTime.toFixed(2)}ms`)
    })

    it('应该能利用缓存加速重复表达式', () => {
      const ctx = createRuntimeContext({
        count: 5,
        multiplier: 2
      })
      
      const expr = 'count * multiplier + 10'
      
      // 第一次求值（无缓存）
      const start1 = performance.now()
      for (let i = 0; i < 100; i++) {
        evaluate(expr, ctx)
      }
      const time1 = performance.now() - start1
      
      // 第二次求值（有缓存）
      const start2 = performance.now()
      for (let i = 0; i < 100; i++) {
        evaluate(expr, ctx)
      }
      const time2 = performance.now() - start2
      
      // 缓存应该显著提升性能
      expect(time2).toBeLessThan(time1)
      console.log(`✓ 无缓存: ${time1.toFixed(2)}ms, 有缓存: ${time2.toFixed(2)}ms, 提升: ${((time1 - time2) / time1 * 100).toFixed(1)}%`)
    })

    it('应该能处理复杂嵌套表达式', () => {
      const ctx = createRuntimeContext({
        items: Array.from({ length: 100 }, (_, i) => ({ value: i })),
        multiplier: 2
      })
      
      const startTime = performance.now()
      
      // 复杂表达式：数组操作 + 计算
      for (let i = 0; i < 100; i++) {
        evaluate(`items[${i}].value * multiplier`, ctx)
      }
      
      const endTime = performance.now()
      const evalTime = endTime - startTime

      expect(evalTime).toBeLessThan(500)
      console.log(`✓ 100 个复杂表达式求值耗时: ${evalTime.toFixed(2)}ms`)
    })
  })

  describe('上下文创建性能', () => {
    it('应该能快速创建 1000 个上下文实例', () => {
      const startTime = performance.now()
      
      for (let i = 0; i < 1000; i++) {
        createRuntimeContext({
          count: i,
          name: `Instance ${i}`
        })
      }
      
      const endTime = performance.now()
      const createTime = endTime - startTime

      expect(createTime).toBeLessThan(1000)
      console.log(`✓ 1000 个上下文创建耗时: ${createTime.toFixed(2)}ms`)
    })

    it('应该能快速创建带大量状态的上下文', () => {
      const largeState: Record<string, unknown> = {}
      for (let i = 0; i < 1000; i++) {
        largeState[`field${i}`] = `value${i}`
      }
      
      const startTime = performance.now()
      
      const ctx = createRuntimeContext(largeState)
      
      const endTime = performance.now()
      const createTime = endTime - startTime

      expect(ctx).toBeDefined()
      expect(createTime).toBeLessThan(500)
      console.log(`✓ 创建包含 1000 个字段的上下文耗时: ${createTime.toFixed(2)}ms`)
    })
  })

  describe('动作执行性能', () => {
    it('应该能快速执行 1000 个 set 动作', async () => {
      const ctx = createRuntimeContext<{ count: number }>({ count: 0 })
      
      const actions = Array.from({ length: 1000 }, (_, i) => ({
        type: 'set' as const,
        path: 'count',
        value: i
      }))
      
      const startTime = performance.now()
      
      await execute(actions, ctx)
      
      const endTime = performance.now()
      const execTime = endTime - startTime

      expect(ctx._get('count')).toBe(999)
      expect(execTime).toBeLessThan(1000)
      console.log(`✓ 1000 个 set 动作执行耗时: ${execTime.toFixed(2)}ms`)
    })

    it('应该能快速执行批量动作', async () => {
      const ctx = createRuntimeContext<{
        a: number
        b: number
        c: number
      }>({ a: 0, b: 0, c: 0 })
      
      // 使用直接数值更新，避免表达式求值的复杂性
      const actions = Array.from({ length: 100 }, (_, i) => ({
        type: 'batch' as const,
        actions: [
          { type: 'set' as const, path: 'a', value: i + 1 },
          { type: 'set' as const, path: 'b', value: i + 1 },
          { type: 'set' as const, path: 'c', value: i + 1 }
        ]
      }))
      
      const startTime = performance.now()
      
      await execute(actions, ctx)
      
      const endTime = performance.now()
      const execTime = endTime - startTime

      expect(ctx._get('a')).toBe(100)
      expect(ctx._get('b')).toBe(100)
      expect(ctx._get('c')).toBe(100)
      expect(execTime).toBeLessThan(2000)
      console.log(`✓ 100 个批量指令执行耗时: ${execTime.toFixed(2)}ms`)
    })
  })

  describe('状态更新性能', () => {
    it('应该能快速更新状态 10000 次', () => {
      const ctx = createRuntimeContext<{ count: number }>({ count: 0 })
      
      const startTime = performance.now()
      
      for (let i = 0; i < 10000; i++) {
        ctx._set('count', i)
      }
      
      const endTime = performance.now()
      const updateTime = endTime - startTime

      expect(ctx._get('count')).toBe(9999)
      expect(updateTime).toBeLessThan(500)
      console.log(`✓ 10000 次状态更新耗时: ${updateTime.toFixed(2)}ms`)
    })

    it('应该能快速更新嵌套路径', () => {
      const ctx = createRuntimeContext<{
        user: {
          profile: {
            name: string
            age: number
          }
        }
      }>({
        user: {
          profile: {
            name: '',
            age: 0
          }
        }
      })
      
      const startTime = performance.now()
      
      for (let i = 0; i < 1000; i++) {
        ctx._set('user.profile.name', `User ${i}`)
        ctx._set('user.profile.age', i)
      }
      
      const endTime = performance.now()
      const updateTime = endTime - startTime

      expect(ctx._get('user.profile.name')).toBe('User 999')
      expect(ctx._get('user.profile.age')).toBe(999)
      expect(updateTime).toBeLessThan(500)
      console.log(`✓ 1000 次嵌套路径更新耗时: ${updateTime.toFixed(2)}ms`)
    })
  })

  describe('混合压力测试', () => {
    it('应该能处理复杂的混合操作', async () => {
      const ctx = createRuntimeContext<{
        items: Array<{ id: number; value: number }>
        count: number
        multiplier: number
      }>({
        items: [],
        count: 0,
        multiplier: 1
      })
      
      const startTime = performance.now()
      
      // 混合操作：创建数据、更新状态、执行指令、求值表达式
      for (let i = 0; i < 100; i++) {
        // 添加项目
        const currentItems = ctx._get('items') as Array<{ id: number; value: number }>
        ctx._set('items', [...currentItems, { id: i, value: i * 2 }])
        
        // 更新计数
        ctx._set('count', i)
        
        // 更新倍数
        ctx._set('multiplier', (i % 10) + 1)
        
        // 求值表达式
        evaluate('count * multiplier', ctx)
        
        // 执行指令（直接使用数值）
        const currentCount = ctx._get('count') as number
        ctx._set('count', currentCount + 1)
      }
      
      const endTime = performance.now()
      const mixedTime = endTime - startTime

      expect(ctx._get('items')).toHaveLength(100)
      expect(ctx._get('count')).toBe(100) // 最后一次循环 i=99，然后 count = 99 + 1 = 100
      expect(mixedTime).toBeLessThan(5000)
      console.log(`✓ 混合操作测试耗时: ${mixedTime.toFixed(2)}ms`)
    })
  })
})
