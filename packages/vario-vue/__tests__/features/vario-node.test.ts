/**
 * 方案 C：子树组件化 单元测试
 */
import { describe, it, expect, vi } from 'vitest'
import { h, Fragment } from 'vue'
import {
  VarioNode,
  createVarioNodeVNode,
  shouldComponentize,
  type VarioNodeRenderer,
  type SubtreeComponentOptions
} from '../../src/features/vario-node'
import type { SchemaNode } from '@variojs/schema'
import type { RuntimeContext, PathSegment } from '@variojs/core'

// Mock 渲染器
function createMockRenderer(): VarioNodeRenderer {
  return {
    resolveComponent: vi.fn((type: string) => type),
    evaluateExpr: vi.fn((expr: string, ctx: RuntimeContext) => {
      if (expr === '{{ visible }}') return ctx._get('visible' as any) ?? true
      if (expr === '{{ show }}') return ctx._get('show' as any) ?? true
      if (expr === 'false') return false
      return true
    }),
    buildAttrs: vi.fn((schema, ctx, component, modelPathStack, nodeContext, parentMap) => {
      return schema.props || {}
    }),
    resolveChildren: vi.fn((schema, ctx, modelPathStack, parentMap, path) => {
      if (!schema.children) return null
      if (typeof schema.children === 'string') return schema.children
      return null
    }),
    createComponentWithLifecycle: vi.fn((component, attrs, children, vueSchema, ctx) => {
      return h(component, attrs, children)
    }),
    attachRef: vi.fn((vnode, vueSchema) => vnode),
    getUpdatedModelPathStack: vi.fn((schema, stack, ctx) => stack)
  }
}

// Mock RuntimeContext
function createMockContext(state: Record<string, any> = {}): RuntimeContext {
  const ctx = {
    _get: vi.fn((key: string) => state[key]),
    _set: vi.fn(),
    state
  } as unknown as RuntimeContext
  return ctx
}

describe('vario-node', () => {
  describe('shouldComponentize', () => {
    it('options.enabled 为 false 时应返回 false', () => {
      const schema: SchemaNode = { type: 'div' }
      const options: SubtreeComponentOptions = { enabled: false }
      
      expect(shouldComponentize(schema, 0, options)).toBe(false)
    })

    it('超过 maxDepth 时应返回 false', () => {
      const schema: SchemaNode = { type: 'div' }
      const options: SubtreeComponentOptions = { enabled: true, maxDepth: 5 }
      
      expect(shouldComponentize(schema, 6, options)).toBe(false)
      expect(shouldComponentize(schema, 5, options)).toBe(true)
    })

    it('granularity=all 时所有节点都应组件化', () => {
      const options: SubtreeComponentOptions = { enabled: true, granularity: 'all' }
      
      expect(shouldComponentize({ type: 'div' }, 0, options)).toBe(true)
      expect(shouldComponentize({ type: 'span' }, 0, options)).toBe(true)
      expect(shouldComponentize({ type: 'ElButton' }, 0, options)).toBe(true)
    })

    it('granularity=boundary 时只有边界节点组件化', () => {
      const options: SubtreeComponentOptions = { enabled: true, granularity: 'boundary' }
      
      // 原生元素不是边界
      expect(shouldComponentize({ type: 'div' }, 0, options)).toBe(false)
      expect(shouldComponentize({ type: 'span' }, 0, options)).toBe(false)
      
      // 自定义组件是边界
      expect(shouldComponentize({ type: 'ElButton' }, 0, options)).toBe(true)
      expect(shouldComponentize({ type: 'MyComponent' }, 0, options)).toBe(true)
      
      // 有 loop 是边界
      expect(shouldComponentize({ 
        type: 'div', 
        loop: { items: '{{ items }}', itemKey: 'item' }
      }, 0, options)).toBe(true)
    })
  })

  describe('VarioNode 组件', () => {
    it('应正确导出组件', () => {
      expect(VarioNode).toBeDefined()
      expect(VarioNode.name).toBe('VarioNode')
    })

    it('应有正确的 props 定义', () => {
      const props = VarioNode.props as Record<string, any>
      
      expect(props.schema).toBeDefined()
      expect(props.ctx).toBeDefined()
      expect(props.path).toBeDefined()
      expect(props.renderer).toBeDefined()
    })
  })

  describe('createVarioNodeVNode', () => {
    it('应创建正确的 VNode', () => {
      const schema: SchemaNode = { type: 'div', props: { class: 'test' } }
      const ctx = createMockContext()
      const renderer = createMockRenderer()

      const vnode = createVarioNodeVNode(schema, ctx, '', renderer)

      expect(vnode).toBeDefined()
      expect(vnode.type).toBe(VarioNode)
      expect(vnode.props?.schema).toBe(schema)
      expect(vnode.props?.ctx).toBe(ctx)
      expect(vnode.props?.path).toBe('')
      expect(vnode.props?.renderer).toBe(renderer)
    })

    it('应正确传递可选参数', () => {
      const schema: SchemaNode = { type: 'div' }
      const ctx = createMockContext()
      const renderer = createMockRenderer()
      const modelPathStack: PathSegment[] = ['form', 'user']
      const parentMap = new WeakMap()

      const vnode = createVarioNodeVNode(schema, ctx, '0.1', renderer, {
        modelPathStack,
        parentMap,
        depth: 3,
        key: 'custom-key'
      })

      expect(vnode.props?.modelPathStack).toBe(modelPathStack)
      expect(vnode.props?.parentMap).toBe(parentMap)
      expect(vnode.props?.depth).toBe(3)
      expect(vnode.key).toBe('custom-key')
    })

    it('默认 key 应为 path', () => {
      const schema: SchemaNode = { type: 'div' }
      const ctx = createMockContext()
      const renderer = createMockRenderer()

      const vnode = createVarioNodeVNode(schema, ctx, '0.1.2', renderer)

      expect(vnode.key).toBe('0.1.2')
    })
  })

  describe('VarioNodeRenderer 接口', () => {
    it('resolveComponent 应被调用', () => {
      const renderer = createMockRenderer()
      renderer.resolveComponent('ElButton')
      
      expect(renderer.resolveComponent).toHaveBeenCalledWith('ElButton')
    })

    it('evaluateExpr 应正确求值', () => {
      const renderer = createMockRenderer()
      const ctx = createMockContext({ visible: true })
      
      const result = renderer.evaluateExpr('{{ visible }}', ctx)
      
      expect(result).toBe(true)
    })

    it('buildAttrs 应返回 props', () => {
      const renderer = createMockRenderer()
      const schema: SchemaNode = { type: 'div', props: { class: 'test' } }
      const ctx = createMockContext()
      
      const attrs = renderer.buildAttrs(schema, ctx, 'div', [], undefined, undefined)
      
      expect(attrs).toEqual({ class: 'test' })
    })
  })
})

describe('子树组件化集成场景', () => {
  it('条件渲染场景', () => {
    const schema: SchemaNode = {
      type: 'div',
      cond: '{{ visible }}',
      children: [{ type: 'span' }]
    }
    const ctx = createMockContext({ visible: true })
    const renderer = createMockRenderer()

    const vnode = createVarioNodeVNode(schema, ctx, '', renderer)

    expect(vnode).toBeDefined()
    expect(vnode.props?.schema.cond).toBe('{{ visible }}')
  })

  it('show 控制场景', () => {
    const schema: SchemaNode = {
      type: 'div',
      show: '{{ show }}',
      props: { class: 'container' }
    }
    const ctx = createMockContext({ show: false })
    const renderer = createMockRenderer()

    const vnode = createVarioNodeVNode(schema, ctx, '', renderer)

    expect(vnode).toBeDefined()
    expect(vnode.props?.schema.show).toBe('{{ show }}')
  })

  it('嵌套结构场景', () => {
    const schema: SchemaNode = {
      type: 'div',
      children: [
        { type: 'span', props: { text: 'Hello' } },
        { 
          type: 'section',
          children: [{ type: 'button' }]
        }
      ]
    }
    const ctx = createMockContext()
    const renderer = createMockRenderer()

    // 根节点
    const rootVnode = createVarioNodeVNode(schema, ctx, '', renderer)
    expect(rootVnode.key).toBe('')

    // 子节点
    const child1Vnode = createVarioNodeVNode(
      (schema.children as SchemaNode[])[0],
      ctx,
      '0',
      renderer
    )
    expect(child1Vnode.key).toBe('0')

    // 嵌套子节点
    const nestedChild = ((schema.children as SchemaNode[])[1].children as SchemaNode[])[0]
    const nestedVnode = createVarioNodeVNode(nestedChild, ctx, '1.0', renderer)
    expect(nestedVnode.key).toBe('1.0')
  })

  it('自定义组件场景', () => {
    const schema: SchemaNode = {
      type: 'ElButton',
      props: { type: 'primary', size: 'large' }
    }
    const ctx = createMockContext()
    const renderer = createMockRenderer()

    const vnode = createVarioNodeVNode(schema, ctx, '', renderer)

    expect(vnode.props?.schema.type).toBe('ElButton')
    expect(vnode.props?.schema.props).toEqual({ type: 'primary', size: 'large' })
  })

  it('生命周期场景', () => {
    const schema = {
      type: 'div',
      onMounted: [{ type: 'log', message: 'mounted' }],
      onUnmounted: [{ type: 'log', message: 'unmounted' }]
    } as any
    const ctx = createMockContext()
    const renderer = createMockRenderer()

    const vnode = createVarioNodeVNode(schema, ctx, '', renderer)

    expect(vnode.props?.schema.onMounted).toBeDefined()
    expect(vnode.props?.schema.onUnmounted).toBeDefined()
  })

  it('不同深度场景', () => {
    const schema: SchemaNode = { type: 'div' }
    const ctx = createMockContext()
    const renderer = createMockRenderer()

    const vnode0 = createVarioNodeVNode(schema, ctx, '', renderer, { depth: 0 })
    const vnode5 = createVarioNodeVNode(schema, ctx, '0.1.2.3.4', renderer, { depth: 5 })

    expect(vnode0.props?.depth).toBe(0)
    expect(vnode5.props?.depth).toBe(5)
  })
})
