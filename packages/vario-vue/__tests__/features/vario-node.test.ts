/**
 * Scope-Weight 子树组件化 单元测试
 */
import { describe, it, expect, vi } from 'vitest'
import { h, Fragment } from 'vue'
import {
  VarioNode,
  createVarioNodeVNode,
  shouldComponentize,
  type VarioNodeRenderer
} from '../../src/features/vario-node'
import {
  COMPONENT_OVERHEAD,
  createWeightCache,
  computeWeight,
  isScopeBoundary,
  type WeightCache
} from '../../src/features/schema-weight'
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

describe('schema-weight', () => {
  describe('computeWeight', () => {
    it('叶子节点 weight = 1', () => {
      const cache = createWeightCache()
      expect(computeWeight({ type: 'span' }, cache)).toBe(1)
      expect(computeWeight({ type: 'div', children: 'text' }, cache)).toBe(1)
    })

    it('容器节点 weight = 1 + Σ children', () => {
      const cache = createWeightCache()
      const schema: SchemaNode = {
        type: 'div',
        children: [{ type: 'span' }, { type: 'span' }, { type: 'span' }]
      }
      expect(computeWeight(schema, cache)).toBe(4)
    })

    it('嵌套结构正确累加', () => {
      const cache = createWeightCache()
      const schema: SchemaNode = {
        type: 'div',
        children: [
          { type: 'div', children: [{ type: 'span' }, { type: 'span' }] },
          { type: 'span' }
        ]
      }
      expect(computeWeight(schema, cache)).toBe(5)
    })

    it('结果应被缓存', () => {
      const cache = createWeightCache()
      const schema: SchemaNode = { type: 'div', children: [{ type: 'span' }] }
      expect(computeWeight(schema, cache)).toBe(2)
      expect(computeWeight(schema, cache)).toBe(2)
    })
  })

  describe('isScopeBoundary', () => {
    it('有 lifecycle 的节点是 scope boundary', () => {
      expect(isScopeBoundary({ type: 'div', onMounted: 'init' } as any)).toBe(true)
    })
    it('有 provide/inject 的节点是 scope boundary', () => {
      expect(isScopeBoundary({ type: 'div', provide: { theme: 'dark' } } as any)).toBe(true)
      expect(isScopeBoundary({ type: 'div', inject: ['theme'] } as any)).toBe(true)
    })
    it('有 model 绑定的节点是 scope boundary', () => {
      expect(isScopeBoundary({ type: 'input', model: 'name' } as any)).toBe(true)
    })
    it('自定义组件是 scope boundary', () => {
      expect(isScopeBoundary({ type: 'ElButton' })).toBe(true)
    })
    it('原生元素无 model 不是 scope boundary', () => {
      expect(isScopeBoundary({ type: 'div' })).toBe(false)
    })
  })
})

describe('vario-node', () => {
  describe('shouldComponentize (Scope-Weight Hybrid)', () => {
    it('轻量 scope boundary 不组件化', () => {
      const cache = createWeightCache()
      expect(shouldComponentize({ type: 'ElButton' }, cache)).toBe(false)
    })

    it('重量 scope boundary 应组件化', () => {
      const cache = createWeightCache()
      const schema: SchemaNode = {
        type: 'ElCard',
        children: Array.from({ length: 6 }, () => ({ type: 'span' }))
      }
      expect(shouldComponentize(schema, cache)).toBe(true)
    })

    it('原生元素即使很重也不组件化', () => {
      const cache = createWeightCache()
      const schema: SchemaNode = {
        type: 'div',
        children: Array.from({ length: 20 }, () => ({ type: 'span' }))
      }
      expect(shouldComponentize(schema, cache)).toBe(false)
    })

    it('有 model 的原生元素且重量足够应组件化', () => {
      const cache = createWeightCache()
      const schema = {
        type: 'div', model: 'form.address',
        children: Array.from({ length: 6 }, () => ({ type: 'span' }))
      } as any
      expect(shouldComponentize(schema, cache)).toBe(true)
    })

    it('有 lifecycle/provide/inject 始终组件化', () => {
      const cache = createWeightCache()
      expect(shouldComponentize({ type: 'div', onMounted: 'init' } as any, cache)).toBe(true)
      expect(shouldComponentize({ type: 'div', provide: { theme: 'dark' } } as any, cache)).toBe(true)
      expect(shouldComponentize({ type: 'div', inject: ['theme'] } as any, cache)).toBe(true)
    })

    it('有 loop 的节点不组件化', () => {
      const cache = createWeightCache()
      expect(shouldComponentize({
        type: 'ElButton',
        loop: { items: '{{ items }}', itemKey: 'item' },
        children: Array.from({ length: 20 }, () => ({ type: 'span' }))
      } as any, cache)).toBe(false)
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
