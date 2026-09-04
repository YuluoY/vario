/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：默认 virtualAdapter=null（AC-8 / T3.7）
 *
 * - 500 项全量渲染
 * - 超过 1000 阈值 emit LOOP_LARGE_LIST 诊断（不截断）
 * - 显式传 reference adapter 仍按窗口截断
 */

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'
import { useVario, getRuntimeMode, setRuntimeMode, createReferenceVirtualAdapter } from '../../src/index.js'

describe('AC-8 默认 virtualAdapter=null', () => {
  it('500 项列表全量渲染（不截断）', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const items = Array.from({ length: 500 }, (_, i) => ({ id: i, n: i }))
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            loop: { items: 'items', itemKey: 'item' },
            children: [{ type: 'span', children: '{{ item.n }}' }]
          } as never,
          { state: { items } as never }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(host.querySelectorAll('span').length).toBe(500)
    expect(host.textContent).toContain('499')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('超过阈值 emit LOOP_LARGE_LIST 诊断', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const events: Array<string | undefined> = []
    const items = Array.from({ length: 1200 }, (_, i) => ({ id: i, n: i }))
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            loop: { items: 'items', itemKey: 'item' },
            children: [{ type: 'span', children: '{{ item.n }}' }]
          } as never,
          {
            state: { items } as never,
            diagnosticSink: { emit(event) { events.push(event.diagnostic?.code) } }
          }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(events).toContain('LOOP_LARGE_LIST')
    expect(host.querySelectorAll('span').length).toBe(1200)
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('显式传 reference adapter 行为不变（窗口截断）', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const items = Array.from({ length: 500 }, (_, i) => ({ id: i, n: i }))
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            loop: { items: 'items', itemKey: 'item' },
            children: [{ type: 'span', children: '{{ item.n }}' }]
          } as never,
          {
            state: { items } as never,
            virtualAdapter: createReferenceVirtualAdapter()
          }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(host.querySelectorAll('span').length).toBeLessThanOrEqual(204)
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })
})
