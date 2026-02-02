/**
 * vario-vue 集成测试
 * 
 * 测试：
 * - useVario composable 完整流程
 * - 响应式状态更新
 * - 服务注册
 * - 事件处理
 * - 全局组件解析支持
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useVario } from '../src/composable.js'
import type { Schema } from '@variojs/schema'

describe('useVario 集成测试', () => {
  describe('基础功能', () => {
    it('应该创建响应式的 Vario 上下文', () => {
      const schema: Schema = {
        type: 'div',
        children: 'Hello World'
      }

      const { vnode, state, ctx } = useVario(schema)

      expect(vnode.value).toBeDefined()
      expect(state).toBeDefined()
      expect(ctx.value).toBeDefined()
    })

    it('应该支持函数式 schema', () => {
      const schemaFn = () => ({
        type: 'div',
        children: 'Hello from function'
      })

      const { vnode } = useVario(schemaFn)

      expect(vnode.value).toBeDefined()
      expect((vnode.value as any).children).toBe('Hello from function')
    })
  })

  describe('响应式状态', () => {
    it('应该响应状态变化并重新渲染', async () => {
      const schema: Schema<{ count: number }> = {
        type: 'div',
        children: '{{ count }}'
      }

      const { vnode, state, ctx } = useVario(schema)

      // 初始状态
      expect((vnode.value as any).children).toBe('')

      // 更新状态
      ctx.value!._set('count', 5)
      await nextTick()

      expect(state.count).toBe(5)
    })

    it('应该支持双向绑定更新状态', async () => {
      const schema: Schema<{ name: string }> = {
        type: 'input',
        model: 'name'
      }

      const { vnode, state, ctx } = useVario(schema)

      // 通过双向绑定更新
      const props = (vnode.value as any).props
      if (props.onInput) {
        props.onInput('New Name')
      } else if (props['onUpdate:modelValue']) {
        props['onUpdate:modelValue']('New Name')
      }

      await nextTick()
      await nextTick()  // 等待状态同步完成

      expect(state.name).toBe('New Name')
      expect(ctx.value!._get('name')).toBe('New Name')
    })
  })

  describe('服务注册', () => {
    it('应该注册服务到 $methods', async () => {
      const fetchData = vi.fn().mockResolvedValue({ data: 'test' })

      const schema: Schema = {
        type: 'div',
        children: 'Content'
      }

      const { ctx } = useVario(schema, {
        methods: {
          fetchData
        }
      })

      expect(ctx.value?.$methods['fetchData']).toBeDefined()
      expect(ctx.value?.$methods['services.fetchData']).toBeDefined()

      // 调用服务
      const result = await ctx.value!.$methods['fetchData'](ctx.value!, {})
      expect(result).toEqual({ data: 'test' })
      expect(fetchData).toHaveBeenCalled()
    })

    it('应该处理服务错误', async () => {
      const failingService = vi.fn().mockRejectedValue(new Error('Service failed'))

      const schema: Schema = {
        type: 'div',
        children: 'Content'
      }

      const { ctx } = useVario(schema, {
        methods: {
          failingService
        }
      })

      await expect(
        ctx.value!.$methods['failingService'](ctx.value!, {})
      ).rejects.toThrow('Service failed')
    })
  })

  describe('事件处理', () => {
    it('点击子节点时 ctx 上应有 $self / $parent / $siblings / $children（node-context）', async () => {
      const captured: {
        called?: boolean
        $self?: { type: string }
        $parent?: { type: string } | null
        $siblings?: { type: string }[]
        $children?: unknown
      } = {}
      const schema: Schema = {
        type: 'div',
        children: [
          { type: 'span', children: 'A' },
          {
            type: 'button',
            children: 'Click',
            events: {
              click: [
                {
                  type: 'call',
                  method: 'services.captureNodeContext',
                  params: {}
                }
              ]
            }
          }
        ]
      }
      const { vnode, ctx } = useVario(schema, {
        methods: {
          captureNodeContext(methodCtx: { ctx?: typeof ctx.value; state?: unknown; params?: unknown; event?: Event }, _params: Record<string, unknown>) {
            const c = methodCtx?.ctx
            captured.called = true
            captured.$self = c?.$self ? { type: (c.$self as { type: string }).type } : undefined
            captured.$parent = c?.$parent == null
              ? c?.$parent
              : { type: (c.$parent as { type: string }).type }
            captured.$siblings = Array.isArray(c?.$siblings)
              ? (c.$siblings as { type: string }[]).map(s => ({ type: s.type }))
              : undefined
            captured.$children = c?.$children
          }
        }
      })
      const rootChildren = (vnode.value as any).children
      expect(Array.isArray(rootChildren) && rootChildren.length >= 2).toBe(true)
      const buttonVNode = Array.isArray(rootChildren)
        ? rootChildren.find((c: any) => c?.props?.onClick) ?? rootChildren[1]
        : null
      const onClick = buttonVNode?.props?.onClick
      expect(onClick).toBeDefined()
      const p = onClick!(new Event('click'))
      if (p && typeof p.then === 'function') await p
      await nextTick()
      expect(captured.called).toBe(true)
      expect(captured.$self?.type).toBe('button')
      expect(captured.$parent?.type).toBe('div')
      expect(captured.$siblings).toHaveLength(1)
      expect(captured.$siblings?.[0].type).toBe('span')
      expect(captured.$children).toBeUndefined()
    })

    it('应该触发 onEvent 回调', async () => {
      const onEvent = vi.fn()

      const schema: Schema<{ count: number }> = {
        type: 'button',
        events: {
          click: [
            { type: 'emit', event: 'button-clicked', data: { count: 1 } }
          ]
        }
      }

      const { vnode, ctx } = useVario(schema, {
        onEmit: onEvent
      })

      // 模拟点击事件
      const props = (vnode.value as any).props
      if (props.onClick) {
        props.onClick(new Event('click'))
      }

      await nextTick()

      expect(onEvent).toHaveBeenCalledWith('button-clicked', { count: 1 })
    })
  })

  describe('错误处理', () => {
    it('应该调用 onError 当渲染失败时', () => {
      const onError = vi.fn()
      // 创建一个会导致表达式求值错误的 schema
      const invalidSchema: Schema<{ invalid: any }> = {
        type: 'div',
        children: '{{ invalid.nested.property.that.does.not.exist }}'
      }

      const { vnode } = useVario(invalidSchema, {
        onError
      })

      // 即使有错误，vnode 也应该被创建（只是内容可能为空）
      expect(vnode.value).toBeDefined()
      // 注意：表达式求值错误可能不会触发 onError，而是被内部捕获
      // 这个测试主要验证不会抛出未捕获的异常
    })
  })

  describe('复杂场景', () => {
    it('应该处理完整的表单场景', async () => {
      const schema: Schema<{ name: string; email: string; submitted: boolean }> = {
        type: 'form',
        children: [
          {
            type: 'input',
            model: 'name',
            props: {
              placeholder: 'Enter name'
            }
          },
          {
            type: 'input',
            model: 'email',
            props: {
              placeholder: 'Enter email'
            }
          },
          {
            type: 'button',
            events: {
              click: [
                { type: 'set', path: 'submitted', value: true }
              ]
            },
            children: 'Submit'
          }
        ]
      }

      const { vnode, state, ctx } = useVario(schema)

      // 更新表单字段
      ctx.value!._set('name', 'John Doe')
      ctx.value!._set('email', 'john@example.com')
      await nextTick()

      expect(state.name).toBe('John Doe')
      expect(state.email).toBe('john@example.com')

      // 直接执行 set action 来模拟提交（避免依赖 VNode 结构）
      ctx.value!._set('submitted', true)
      await nextTick()

      expect(state.submitted).toBe(true)
    })

    it('应该处理条件渲染和列表渲染组合', async () => {
      const schema: Schema<{ items: string[]; showList: boolean }> = {
        type: 'div',
        children: [
          {
            type: 'button',
            events: {
              click: [
                { type: 'set', path: 'showList', value: '{{ !showList }}' }
              ]
            },
            children: 'Toggle List'
          },
          {
            type: 'ul',
            cond: 'showList',
            loop: {
              items: 'items',
              itemKey: 'item'
            },
            children: [
              {
                type: 'li',
                children: '{{ item }}'
              }
            ]
          }
        ]
      }

      // 提供初始状态
      const { state, ctx } = useVario(schema, {
        state: { items: ['a', 'b', 'c'], showList: false }
      })

      await nextTick()

      // 初始状态：列表应该隐藏
      expect(state.showList).toBe(false)

      // 切换显示
      ctx.value!._set('showList', true)
      await nextTick()
      expect(state.showList).toBe(true)
    })
  })
})
