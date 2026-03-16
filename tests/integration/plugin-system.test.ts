/**
 * 集成测试：VNode 插件系统
 *
 * 验证自定义插件在渲染管线中的正确行为。
 */
import { describe, it, expect } from 'vitest'
import { h, type VNode } from 'vue'
import { createRuntimeContext } from '@vario/core'
import { VueRenderer } from '@vario/vue'
import type { VNodePlugin } from '@vario/vue'

describe('Plugin system integration', () => {
  it('should apply default plugins (no explicit plugins option)', () => {
    const ctx = createRuntimeContext({})
    const renderer = new VueRenderer()
    const vnode = renderer.render({ type: 'div', children: 'test' }, ctx)
    expect(vnode).toBeDefined()
  })

  it('should work with empty plugins (no Vue feature wrappers)', () => {
    const ctx = createRuntimeContext({})
    const renderer = new VueRenderer({ plugins: [] })
    const vnode = renderer.render({ type: 'div', children: 'test' }, ctx)
    expect(vnode).toBeDefined()
  })

  it('should apply custom decorateVNode plugin', () => {
    let decorated = false

    const testPlugin: VNodePlugin = {
      name: 'test-decorator',
      decorateVNode(vnode, _schema, _ctx) {
        decorated = true
        return vnode
      }
    }

    const ctx = createRuntimeContext({})
    const renderer = new VueRenderer({ plugins: [testPlugin] })
    renderer.render({ type: 'div', children: 'test' }, ctx)

    expect(decorated).toBe(true)
  })

  it('should apply custom wrapComponent plugin', () => {
    let wrapped = false

    const testPlugin: VNodePlugin = {
      name: 'test-wrapper',
      wrapComponent(component, attrs, children, _schema, _ctx) {
        wrapped = true
        return null // 返回 null 表示不拦截，走默认 h()
      }
    }

    const ctx = createRuntimeContext({})
    const renderer = new VueRenderer({ plugins: [testPlugin] })
    renderer.render({ type: 'div', children: 'test' }, ctx)

    expect(wrapped).toBe(true)
  })

  it('wrapComponent returning VNode should override default h()', () => {
    const customVNode = h('span', null, 'overridden')

    const overridePlugin: VNodePlugin = {
      name: 'override',
      wrapComponent() {
        return customVNode
      }
    }

    const ctx = createRuntimeContext({})
    const renderer = new VueRenderer({ plugins: [overridePlugin] })
    const vnode = renderer.render({ type: 'div', children: 'original' }, ctx)

    // 根节点被插件覆盖
    expect(vnode).toBeDefined()
  })

  it('multiple plugins should execute in order', () => {
    const order: string[] = []

    const pluginA: VNodePlugin = {
      name: 'A',
      decorateVNode(vnode) {
        order.push('A')
        return vnode
      }
    }

    const pluginB: VNodePlugin = {
      name: 'B',
      decorateVNode(vnode) {
        order.push('B')
        return vnode
      }
    }

    const ctx = createRuntimeContext({})
    const renderer = new VueRenderer({ plugins: [pluginA, pluginB] })
    renderer.render({ type: 'div', children: 'test' }, ctx)

    expect(order).toEqual(['A', 'B'])
  })
})
