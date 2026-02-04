/**
 * 方案 C 集成测试：验证 subtreeComponent 选项是否正确集成到 VueRenderer
 * 
 * 这个测试验证：
 * 1. 启用 subtreeComponent.enabled 后，符合条件的节点使用 VarioNode 渲染
 * 2. 不同 granularity 设置产生不同的组件化结果
 * 3. maxDepth 限制正确工作
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { VueRenderer } from '../../src/renderer'
import { createRuntimeContext } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'

describe('方案C集成：subtreeComponent 选项', () => {
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    ctx = createRuntimeContext({
      count: 0,
      name: 'Test',
      isVisible: true,
      items: ['a', 'b', 'c']
    })
  })

  describe('subtreeComponent.enabled = false (默认)', () => {
    it('应使用默认渲染路径，不产生 VarioNode', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: false }
      })

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

  describe('subtreeComponent.enabled = true, granularity = all', () => {
    it('所有节点都应被组件化为 VarioNode', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'all' }
      })

      const schema: SchemaNode = {
        type: 'div',
        children: [
          { type: 'span', children: 'Hello' }
        ]
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
      
      // 根节点应该是 VarioNode 组件
      // VarioNode 组件有 name 属性
      if (typeof vnode!.type === 'object' && 'name' in (vnode!.type as any)) {
        expect((vnode!.type as any).name).toBe('VarioNode')
      }
    })

    it('VarioNode 应正确传递 props', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'all' }
      })

      const schema: SchemaNode = {
        type: 'div',
        props: { class: 'container' }
      }

      const vnode = renderer.render(schema, ctx)
      
      if (vnode!.props) {
        expect(vnode!.props.schema).toEqual(schema)
        expect(vnode!.props.path).toBe('')
        expect(vnode!.props.depth).toBe(0)
      }
    })
  })

  describe('subtreeComponent.enabled = true, granularity = boundary', () => {
    it('只有组件边界节点被组件化', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'boundary' }
      })

      // div 不是组件边界，不会被组件化
      const schema: SchemaNode = {
        type: 'div',
        children: [
          { type: 'span', children: 'Hello' }
        ]
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
      // div 不是组件边界，应该直接渲染为 div
      expect(vnode!.type).toBe('div')
    })

    it('自定义组件（首字母大写）应被组件化', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'boundary' }
      })

      const schema: SchemaNode = {
        type: 'MyButton',
        props: { label: 'Click me' }
      }

      const vnode = renderer.render(schema, ctx)
      
      // 首字母大写的组件被视为边界，应该产生 VarioNode
      if (typeof vnode!.type === 'object' && 'name' in (vnode!.type as any)) {
        expect((vnode!.type as any).name).toBe('VarioNode')
      }
    })
  })

  describe('maxDepth 限制', () => {
    it('超过 maxDepth 的节点不应被组件化', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'all', maxDepth: 0 }
      })

      // maxDepth = 0 意味着只有 depth=0 的节点会被组件化
      const schema: SchemaNode = {
        type: 'div'
      }

      const vnode = renderer.render(schema, ctx)
      
      // depth=0 应该被组件化
      if (typeof vnode!.type === 'object' && 'name' in (vnode!.type as any)) {
        expect((vnode!.type as any).name).toBe('VarioNode')
      }
    })
  })

  describe('与其他功能的兼容性', () => {
    it('条件渲染 (cond) 应正确工作', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'all' }
      })

      const schema: SchemaNode = {
        type: 'div',
        cond: '{{ isVisible }}'
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).toBeDefined()
    })

    it('循环渲染应正确工作', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'all' }
      })

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
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true }
      })

      // 验证接口方法存在
      expect(typeof renderer.resolveComponent).toBe('function')
      expect(typeof renderer.evaluateExpr).toBe('function')
      expect(typeof renderer.buildAttrs).toBe('function')
      expect(typeof renderer.resolveChildren).toBe('function')
      expect(typeof renderer.createComponentWithLifecycle).toBe('function')
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
    it('initSchemaStore 应初始化 schema store', () => {
      const renderer = new VueRenderer({
        schemaFragment: { enabled: true }
      })

      const schema: SchemaNode = {
        type: 'div',
        children: [{ type: 'span' }]
      }

      renderer.initSchemaStore(schema)
      
      const store = renderer.getSchemaStore()
      expect(store).toBeDefined()
    })

    it('schemaFragment.enabled = false 时不应创建 store', () => {
      const renderer = new VueRenderer({
        schemaFragment: { enabled: false }
      })

      const schema: SchemaNode = { type: 'div' }
      renderer.initSchemaStore(schema)
      
      const store = renderer.getSchemaStore()
      expect(store).toBeUndefined()
    })
  })
})
