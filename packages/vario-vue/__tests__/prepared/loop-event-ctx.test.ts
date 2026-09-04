/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：prepared 循环事件 ctx（AC-8 / KG-8）
 *
 * - 点击第二行方法收到 $item.name === 'B'、$index === 1
 * - loop 模板含组件化子树（VarioNode 延迟渲染）时 {{ $item.name }} 可用
 * - cell 卸载后 live 计数归零
 */

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, nextTick, onMounted } from 'vue'
import { useVario, getRuntimeMode, setRuntimeMode } from '../../src/index.js'

describe('AC-8 prepared 循环事件 ctx', () => {
  it('点击第二行方法收到对应 $item 与 $index', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const received: Array<{ name: unknown; index: unknown }> = []
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
              type: 'button',
              events: { click: [{ type: 'call', method: 'pick' }] },
              children: '{{ item.name }}'
            }]
          } as never,
          {
            state: { items: [{ name: 'A' }, { name: 'B' }] } as never,
            methods: {
              pick: ({ ctx }: { ctx: Record<string, unknown> }) => {
                received.push({ name: (ctx.$item as { name: string })?.name, index: ctx.$index })
              }
            }
          }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    const buttons = host.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    buttons[1].click()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(received).toEqual([{ name: 'B', index: 1 }])
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('loop 模板含组件化子树（lifecycle 触发组件化）时 $item 可用', async () => {
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
            loop: { items: 'items', itemKey: 'item' },
            children: [{
              type: 'section',
              onMounted: 'noop',
              children: '{{ item.name }}-{{ $index }}'
            }]
          } as never,
          {
            state: { items: [{ name: 'X' }, { name: 'Y' }] } as never,
            methods: { noop: () => {} }
          }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(host.textContent).toContain('X-0')
    expect(host.textContent).toContain('Y-1')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('卸载后 __varioLiveLoopItemCells 归零（ctx 跟随组件生命周期）', async () => {
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
            loop: { items: 'items', itemKey: 'item' },
            children: [{ type: 'span', children: '{{ item.name }}' }]
          } as never,
          { state: { items: [{ name: 'A' }] } as never }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect((globalThis as { __varioLiveLoopItemCells?: number }).__varioLiveLoopItemCells ?? 0).toBeGreaterThan(0)
    app.unmount()
    await nextTick()
    expect((globalThis as { __varioLiveLoopItemCells?: number }).__varioLiveLoopItemCells ?? 0).toBe(0)
    host.remove()
    setRuntimeMode(previous)
  })
})
