/**
 * useVario 增强功能测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ref, reactive, computed, nextTick } from 'vue'
import { useVario } from '../src/composable.js'
import type { Schema } from '@vario/schema'

describe('useVario 增强功能', () => {
  describe('状态双向同步', () => {
    it('应该同步运行时状态到 Vue 状态', async () => {
      const schema: Schema<{ count: number }> = {
        type: 'div',
        children: '{{ count }}'
      }

      const { state, ctx } = useVario(schema, {
        state: reactive({ count: 0 })
      })

      // 通过运行时上下文修改
      ctx.value._set('count', 10)

      // Vue 状态应该同步
      expect(state.count).toBe(10)
    })

    it('应该同步 Vue 状态到运行时上下文', async () => {
      const schema: Schema<{ count: number }> = {
        type: 'div',
        children: '{{ count }}'
      }

      const { state, ctx } = useVario(schema, {
        state: reactive({ count: 0 })
      })

      // 通过 Vue 状态修改
      state.count = 20
      
      // 等待 watch 执行完成
      await nextTick()
      await nextTick()  // 需要两次 nextTick，一次用于 watch，一次用于同步

      // 运行时上下文应该同步
      expect(ctx.value._get('count')).toBe(20)
    })

    it('应该防止循环更新', async () => {
      const schema: Schema<{ count: number }> = {
        type: 'div',
        events: {
          click: [
            { type: 'set', path: 'count', value: '{{ count + 1 }}' }
          ]
        }
      }

      const { state, ctx } = useVario(schema, {
        state: reactive({ count: 0 })
      })

      // 触发状态变更
      ctx.value._set('count', 5)
      
      // 应该不会导致循环更新
      expect(state.count).toBe(5)
    })
  })

  describe('计算属性集成', () => {
    it('应该支持 Options 风格计算属性', () => {
      const schema: Schema<{ count: number; doubleCount: number }> = {
        type: 'div',
        children: '{{ doubleCount }}'
      }

      const { state } = useVario(schema, {
        state: reactive({ count: 5 }),
        computed: {
          doubleCount: (state) => state.count * 2
        }
      })

      expect(state.doubleCount).toBe(10)
    })

    it('应该支持 Composition 风格计算属性', () => {
      const schema: Schema<{ count: number; doubleCount: number }> = {
        type: 'div',
        children: '{{ doubleCount }}'
      }

      const count = ref(5)
      const doubleCount = computed(() => count.value * 2)

      const { state } = useVario(schema, {
        state: reactive({ count: count.value }),
        computed: {
          doubleCount
        }
      })

      expect(state.doubleCount).toBe(10)
    })

    it('应该同步计算属性到运行时上下文', () => {
      const schema: Schema<{ count: number; doubleCount: number }> = {
        type: 'div',
        children: '{{ doubleCount }}'
      }

      const { state, ctx } = useVario(schema, {
        state: reactive({ count: 5 }),
        computed: {
          doubleCount: (state) => state.count * 2
        }
      })

      expect(ctx.value._get('doubleCount')).toBe(10)
    })
  })

  describe('方法注册与调用', () => {
    it('应该自动检测异步方法', async () => {
      const schema: Schema<{ result: string }> = {
        type: 'div',
        events: {
          click: [
            { type: 'call', method: 'asyncMethod', resultTo: 'result' }
          ]
        }
      }

      const { ctx } = useVario(schema, {
        state: reactive({ result: '' }),
        methods: {
          asyncMethod: async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return 'async result'
          }
        }
      })

      const result = await ctx.value.$methods.asyncMethod(ctx.value, {})
      expect(result).toBe('async result')
    })

    it('应该正确处理同步方法', async () => {
      const schema: Schema<{ result: number }> = {
        type: 'div'
      }

      const { ctx } = useVario(schema, {
        state: reactive({ result: 0 }),
        methods: {
          syncMethod: () => {
            return 42
          }
        }
      })

      const result = await ctx.value.$methods.syncMethod(ctx.value, {})
      expect(result).toBe(42)
    })

    it('应该正确处理方法错误', async () => {
      const schema: Schema = {
        type: 'div',
        events: {
          click: [
            { type: 'call', method: 'errorMethod' }
          ]
        }
      }

      const { ctx } = useVario(schema, {
        methods: {
          errorMethod: () => {
            throw new Error('Test error')
          }
        }
      })

      await expect(
        ctx.value.$methods.errorMethod(ctx.value, {})
      ).rejects.toThrow('Test error')
    })
  })

  describe('双向绑定系统', () => {
    it('应该支持单 model 绑定', () => {
      const schema: Schema<{ name: string }> = {
        type: 'Input',
        model: 'name'
      }

      const { state, ctx } = useVario(schema, {
        state: reactive({ name: 'John' })
      })

      expect(ctx.value._get('name')).toBe('John')
    })

    it('应该支持多 model 绑定', () => {
      const schema: Schema<{ email: string; checked: boolean }> = {
        type: 'CustomInput',
        'model:value': 'email',
        'model:checked': 'checked'
      } as any

      const { state, ctx } = useVario(schema, {
        state: reactive({ email: 'test@example.com', checked: true })
      })

      expect(ctx.value._get('email')).toBe('test@example.com')
      expect(ctx.value._get('checked')).toBe(true)
    })
  })
})
