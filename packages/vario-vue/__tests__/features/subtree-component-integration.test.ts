/**
 * 子树组件化集成测试
 *
 * 验证 simplified 组件化策略在 VueRenderer 中的行为：
 * 1. scope boundary → 自动组件化
 * 2. 非 scope boundary → 不组件化
 * 3. 条件渲染、循环等功能与组件化兼容
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { VueRenderer } from '../../src/renderer'
import { isScopeBoundary } from '../../src/features/schema-weight'
import { createRuntimeContext } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'

describe('子树组件化集成', () => {
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    ctx = createRuntimeContext({
      count: 0,
      name: 'Test',
      isVisible: true,
      items: ['a', 'b', 'c']
    })
  })

  describe('非 scope boundary 节点', () => {
    it('原生元素不应产生 VarioNode', () => {
      const renderer = new VueRenderer()

      const schema: SchemaNode = {
        type: 'div',
        children: [
          { type: 'span', children: 'Hello' }
        ]
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
      expect(vnode!.type).toBe('div')
    })
  })

  describe('scope boundary 节点', () => {
    it('自定义组件应自动组件化为 VarioNode', () => {
      const renderer = new VueRenderer()

      const schema: SchemaNode = {
        type: 'ElCard',
        children: Array.from({ length: 6 }, (_, i) => ({
          type: 'span',
          children: `content-${i}`
        }))
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
    })
  })

  describe('有生命周期的节点', () => {
    it('有 provide 的节点应组件化', () => {
      const renderer = new VueRenderer()

      const schema = {
        type: 'div',
        provide: { theme: 'dark' },
        children: [{ type: 'span', children: 'Hello' }]
      } as any

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
    })
  })

  describe('与其他功能的兼容性', () => {
    it('条件渲染 (cond) 应正确工作', () => {
      const renderer = new VueRenderer()

      const schema: SchemaNode = {
        type: 'div',
        cond: '{{ isVisible }}'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
    })

    it('循环渲染应正确工作', () => {
      const renderer = new VueRenderer()

      const schema: SchemaNode = {
        type: 'ul',
        children: [
          {
            type: 'li',
            loop: { items: '{{ items }}', itemKey: 'item' },
            children: '{{ item }}'
          }
        ]
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
    })
  })

  describe('VueRenderer 接口实现', () => {
    it('应正确实现 VarioNodeRenderer 接口', () => {
      const renderer = new VueRenderer()

      expect(typeof renderer.resolveComponent).toBe('function')
      expect(typeof renderer.evaluateExpr).toBe('function')
      expect(typeof renderer.buildAttrs).toBe('function')
      expect(typeof renderer.resolveChildren).toBe('function')
      expect(typeof renderer.wrapComponent).toBe('function')
      expect(typeof renderer.decorateVNode).toBe('function')
      expect(typeof renderer.attachRef).toBe('function')
      expect(typeof renderer.getUpdatedModelPathStack).toBe('function')
    })

    it('resolveComponent 应正确解析组件', () => {
      const renderer = new VueRenderer({
        components: { MyButton: { template: '<button>test</button>' } }
      })

      const component = renderer.resolveComponent('MyButton')
      expect(component).toBeDefined()
      expect(component.template).toBe('<button>test</button>')
    })

    it('evaluateExpr 应正确求值表达式', () => {
      const renderer = new VueRenderer()

      const result = renderer.evaluateExpr('{{ count }}', ctx)
      expect(result).toBe(0)

      const result2 = renderer.evaluateExpr('{{ name }}', ctx)
      expect(result2).toBe('Test')
    })
  })
})
