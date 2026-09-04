/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：prepared 别名循环（AC-8 / KG-9）
 *
 * - itemKey: 'user' 循环输出 ['A','B']（各行独立，不跨行命中 memo）
 * - 嵌套 loop 别名不串
 */

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'
import { useVario, getRuntimeMode, setRuntimeMode } from '../../src/index.js'

describe('AC-8 prepared 别名循环', () => {
  it('itemKey: "user" 循环各行独立输出 A、B', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const items = [{ name: 'A' }, { name: 'B' }]
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            loop: { items: 'items', itemKey: 'user', indexKey: 'idx' },
            children: [{ type: 'span', children: '{{ user.name }}' }]
          } as never,
          { state: { items } as never }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    const spans = host.querySelectorAll('span')
    expect(spans.length).toBe(2)
    expect(spans[0].textContent).toBe('A')
    expect(spans[1].textContent).toBe('B')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('别名 + $item 混用一致；更新单项后对应行刷新', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const items = [{ name: 'A', done: false }, { name: 'B', done: false }]
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            loop: { items: 'items', itemKey: 'user' },
            children: [{ type: 'span', children: '{{ user.name }}:{{ $item.done }}' }]
          } as never,
          { state: { items } as never }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(host.textContent).toContain('A:false')
    expect(host.textContent).toContain('B:false')
    api.ctx.value._set('items.1.done', true)
    await nextTick()
    expect(host.textContent).toContain('B:true')
    expect(host.textContent).toContain('A:false')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('嵌套 loop 各层别名不串', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const state = {
      rows: [
        { title: 'r1', cells: [{ v: 'c11' }, { v: 'c12' }] },
        { title: 'r2', cells: [{ v: 'c21' }] }
      ]
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            loop: { items: 'rows', itemKey: 'row' },
            children: [{
              type: 'p',
              loop: { items: 'row.cells', itemKey: 'cell' },
              children: '{{ row.title }}-{{ cell.v }}'
            }]
          } as never,
          { state: state as never }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(host.textContent).toContain('r1-c11')
    expect(host.textContent).toContain('r1-c12')
    expect(host.textContent).toContain('r2-c21')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })
})
