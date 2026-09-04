/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：prepared lifecycle ctx / 组件解析 / ref（AC-8 / T3.3）
 *
 * - 循环内 onMounted 收到对应 $item
 * - app.component('Card') 全局组件可解析
 * - prepared 下 ref 可用
 */

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { useVario, getRuntimeMode, setRuntimeMode } from '../../src/index.js'

const Card = defineComponent({
  name: 'VarioCard',
  props: { title: { type: String, default: '' } },
  setup(props, { slots }) {
    return () => h('div', { class: 'card' }, [h('b', null, props.title), slots.default?.()])
  }
})

describe('AC-8 prepared lifecycle ctx / 组件 / ref', () => {
  it('循环内 onMounted 收到对应 $item', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const mountedItems: unknown[] = []
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            loop: { items: 'items', itemKey: 'item' },
            children: [{
              type: 'span',
              onMounted: 'capture',
              children: '{{ item.name }}'
            }]
          } as never,
          {
            state: { items: [{ name: 'A' }, { name: 'B' }] } as never,
            methods: {
              capture: ({ ctx }: { ctx: Record<string, unknown> }) => {
                mountedItems.push((ctx.$item as { name: string })?.name)
              }
            }
          }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(mountedItems.sort()).toEqual(['A', 'B'])
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('app.component("VarioCard") 可解析并渲染', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            children: [{ type: 'VarioCard', props: { title: '{{ title }}' }, children: 'body' }]
          } as never,
          { state: { title: 'T1' } as never }
        )
        return () => api.vnode.value
      }
    }))
    app.component('VarioCard', Card)
    app.mount(host)
    await nextTick()
    const card = host.querySelector('.card')
    expect(card).not.toBeNull()
    expect(card!.querySelector('b')!.textContent).toBe('T1')
    expect(card!.textContent).toContain('body')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('prepared 下 ref 可用（循环外为单个元素）', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            children: [{ type: 'span', ref: 'label', children: 'ref-target' }]
          } as never,
          { state: {} as never }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    await nextTick()
    const refValue = (api.refs as Record<string, { value: unknown }>).label.value
    expect(refValue).toBeDefined()
    expect((refValue as HTMLElement).tagName).toBe('SPAN')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })
})
