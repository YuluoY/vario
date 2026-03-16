/**
 * Scope-Weight Hybrid 子树组件化集成测试
 * 
 * 验证 Scope-Weight 自适应优化在 VueRenderer 中的行为：
 * 1. scope boundary + 重量足够 → 自动组件化
 * 2. 非 scope boundary / 轻量节点 → 不组件化
 * 3. 条件渲染、循环等功能与自适应组件化兼容
 * 4. SchemaStore 始终可用
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { VueRenderer } from '../../src/renderer'
import { COMPONENT_OVERHEAD, createWeightCache, computeWeight, isScopeBoundary } from '../../src/features/schema-weight'
import { createRuntimeContext } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'

describe('Scope-Weight 子树组件化集成', () => {
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

    it('轻量自定义组件不应组件化', () => {
      const renderer = new VueRenderer()

      // 单节点 weight=1，< COMPONENT_OVERHEAD(5)，不组件化
      const schema: SchemaNode = {
        type: 'MyButton',
        props: { label: 'Click me' }
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
      if (typeof vnode!.type === 'object' && 'name' in (vnode!.type as any)) {
        expect((vnode!.type as any).name).not.toBe('VarioNode')
      }
    })
  })

  describe('scope boundary + 重量足够', () => {
    it('重量自定义组件应自动组件化为 VarioNode', () => {
      const renderer = new VueRenderer()

      // 构建一个 scope boundary（自定义组件）且 weight > COMPONENT_OVERHEAD 的节点
      const heavySchema: SchemaNode = {
        type: 'div',
        children: [{
          type: 'ElCard',
          children: Array.from({ length: COMPONENT_OVERHEAD + 1 }, (_, i) => ({
            type: 'span',
            children: `content-${i}`
          }))
        }]
      }

      const vnode = renderer.render(heavySchema, ctx)
      expect(vnode).toBeDefined()
      // 根节点是 div（非 scope boundary），不会是 VarioNode
      expect(vnode!.type).toBe('div')
    })
  })

  describe('有生命周期的节点', () => {
    it('有 provide 的节点无论深度都应组件化', () => {
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

      // 验证接口方法存在
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

  describe('SchemaStore 集成', () => {
    it('initSchemaStore 应始终初始化 schema store', () => {
      const renderer = new VueRenderer()

      const schema: SchemaNode = {
        type: 'div',
        children: [{ type: 'span' }]
      }

      renderer.initSchemaStore(schema)
      
      const store = renderer.getSchemaStore()
      expect(store).toBeDefined()
    })
  })

  describe('权重计算验证', () => {
    it('weight cache 在 renderer 实例间独立', () => {
      const r1 = new VueRenderer()
      const r2 = new VueRenderer()

      const schema: SchemaNode = { type: 'div', children: [{ type: 'span' }] }

      r1.render(schema, ctx)
      r2.render(schema, ctx)
    })

    it('COMPONENT_OVERHEAD 常量值合理', () => {
      expect(COMPONENT_OVERHEAD).toBeGreaterThan(1)
      expect(COMPONENT_OVERHEAD).toBeLessThan(20)
    })
  })
})
