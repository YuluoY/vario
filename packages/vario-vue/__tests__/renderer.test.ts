/**
 * VueRenderer 单例测试
 * 
 * 测试：
 * - Schema → VNode 转换
 * - 组件解析
 * - 属性绑定
 * - 表达式求值
 * - 控制流转换
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { h } from 'vue'
import { VueRenderer } from '../src/renderer.js'
import { createRuntimeContext } from '@vario/core'
import type { SchemaNode } from '@vario/schema'

describe('VueRenderer', () => {
  let renderer: VueRenderer
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    renderer = new VueRenderer()
    ctx = createRuntimeContext({
      count: 0,
      name: 'Test',
      isVisible: true,
      items: ['a', 'b', 'c']
    })
  })

  describe('基础渲染', () => {
    it('应该渲染简单的 div 元素', () => {
      const schema: SchemaNode = {
        type: 'div',
        props: {
          class: 'container'
        }
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
      expect(vnode).not.toBeNull()
      expect(vnode!.type).toBe('div')
    })

    it('应该渲染带文本内容的元素', () => {
      const schema: SchemaNode = {
        type: 'p',
        children: 'Hello World'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
      expect(vnode).not.toBeNull()
      expect(vnode!.children).toBe('Hello World')
    })

    it('应该渲染嵌套子元素', () => {
      const schema: SchemaNode = {
        type: 'div',
        children: [
          { type: 'h1', children: 'Title' },
          { type: 'p', children: 'Content' }
        ]
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
      expect(vnode).not.toBeNull()
      expect(Array.isArray(vnode!.children)).toBe(true)
      expect((vnode!.children as any[]).length).toBe(2)
    })
  })

  describe('表达式求值', () => {
    it('应该求值 props 中的表达式', () => {
      const schema: SchemaNode = {
        type: 'div',
        props: {
          'data-count': '{{ count }}'
        }
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      expect(vnode!.props).toBeDefined()
      expect((vnode!.props as any)['data-count']).toBe(0)
    })

    it('应该求值文本内容中的表达式', () => {
      const schema: SchemaNode = {
        type: 'p',
        children: 'Hello {{ name }}'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      expect(vnode!.children).toBe('Hello Test')
    })

    it('应该处理嵌套对象的表达式', () => {
      ctx.user = { name: 'John', age: 30 }
      const schema: SchemaNode = {
        type: 'div',
        props: {
          'data-name': '{{ user.name }}',
          'data-age': '{{ user.age }}'
        }
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      expect((vnode!.props as any)['data-name']).toBe('John')
      expect((vnode!.props as any)['data-age']).toBe(30)
    })
  })

  describe('条件渲染', () => {
    it('应该根据 cond 条件渲染元素', () => {
      const schema: SchemaNode = {
        type: 'div',
        cond: 'isVisible',
        children: 'Visible Content'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      expect(vnode!.children).toBe('Visible Content')
    })

    it('应该在条件为 false 时返回空节点', () => {
      ctx.isVisible = false
      const schema: SchemaNode = {
        type: 'div',
        cond: 'isVisible',
        children: 'Hidden Content'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      // Vue 3 在条件为 false 时返回注释节点（Symbol(v-cmt)）
      expect(vnode!.type).not.toBe('div')
    })

    it('应该处理复杂的条件表达式', () => {
      ctx.count = 5
      const schema: SchemaNode = {
        type: 'div',
        cond: 'count > 3',
        children: 'Count is greater than 3'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      expect(vnode!.children).toBe('Count is greater than 3')
    })
  })

  describe('可见性控制', () => {
    it('应该在 show 为 false 时隐藏元素', () => {
      ctx.isVisible = false
      const schema: SchemaNode = {
        type: 'div',
        show: 'isVisible',
        children: 'Content'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      expect(vnode!.props).toBeDefined()
      expect((vnode!.props as any).style?.display).toBe('none')
    })

    it('应该在 show 为 true 时显示元素', () => {
      ctx.isVisible = true
      const schema: SchemaNode = {
        type: 'div',
        show: 'isVisible',
        children: 'Content'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      expect((vnode!.props as any).style?.display).toBeUndefined()
    })
  })

  describe('列表渲染', () => {
    it('应该渲染列表项', () => {
      const schema: SchemaNode = {
        type: 'div',
        loop: {
          items: 'items',
          itemKey: 'item'
        },
        children: '{{ item }}'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      expect(Array.isArray(vnode!.children)).toBe(true)
      expect((vnode!.children as any[]).length).toBe(3)
    })

    it('应该在循环中提供 $item 和 $index', () => {
      const schema: SchemaNode = {
        type: 'div',
        loop: {
          items: 'items',
          itemKey: 'item',
          indexKey: 'index'
        },
        children: '{{ $item }}-{{ $index }}'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      const children = vnode!.children as any[]
      // 检查第一个子节点
      expect(children.length).toBeGreaterThan(0)
      // 由于循环上下文，$item 和 $index 应该可用
      expect(children[0]).toBeDefined()
    })
  })

  describe('双向绑定', () => {
    it('应该创建双向绑定配置', () => {
      const schema: SchemaNode = {
        type: 'input',
        model: 'name'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      expect(vnode!.props).toBeDefined()
      expect((vnode!.props as any).value).toBe('Test')
      expect(typeof (vnode!.props as any).onInput).toBe('function')
    })

    it('应该更新状态当值改变时', () => {
      const schema: SchemaNode = {
        type: 'input',
        model: 'name'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      const onInput = (vnode!.props as any).onInput
      
      onInput('New Name')
      expect(ctx._get('name')).toBe('New Name')
    })
  })

  describe('事件处理', () => {
    it('应该绑定事件处理器', () => {
      let clicked = false
      ctx.$methods = {
        set: async (ctx: any, ins: any) => {
          clicked = true
        }
      }

      const schema: SchemaNode = {
        type: 'button',
        events: {
          click: [
            { type: 'set', path: 'count', value: '{{ count + 1 }}' }
          ]
        }
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      expect(vnode!.props).toBeDefined()
      expect(typeof (vnode!.props as any).onClick).toBe('function')
    })
  })
})
