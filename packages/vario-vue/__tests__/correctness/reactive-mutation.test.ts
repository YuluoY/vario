/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：legacy 直接改 reactive state 后视图更新（AC-2）
 *
 * 覆盖：state.count=20、state.form.name、cond、list.push+length、
 * _set('items.0.name')、_set('form',{...})、10ms 节奏三连点 1,2,3、
 * state 初始 {} 后赋 form.email。
 */

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, nextTick, reactive } from 'vue'
import { useVario } from '../../src/index.js'

function mountVario(schema: unknown, state: Record<string, unknown>) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  let api!: ReturnType<typeof useVario>
  const app = createApp(defineComponent({
    setup() {
      api = useVario(schema as never, { state: state as never })
      return () => api.vnode.value
    }
  }))
  app.mount(host)
  return {
    host,
    api: () => api,
    unmount: () => {
      app.unmount()
      host.remove()
    }
  }
}

describe('AC-2 legacy 直接改 reactive state 视图更新', () => {
  it('state.count = 20 后 {{ count }} 更新', async () => {
    const state = { count: 0 }
    const mounted = mountVario(
      { type: 'div', children: '{{ count }}' },
      state
    )
    await nextTick()
    expect(mounted.host.textContent).toBe('0')
    ;(mounted.api().state as { count: number }).count = 20
    await nextTick()
    expect(mounted.host.textContent).toBe('20')
    mounted.unmount()
  })

  it('state.form.name 修改后 {{ form.name }} 更新', async () => {
    const state = { form: { name: 'a' } }
    const mounted = mountVario(
      { type: 'div', children: '{{ form.name }}' },
      state
    )
    await nextTick()
    expect(mounted.host.textContent).toBe('a')
    ;(mounted.api().state as { form: { name: string } }).form.name = 'b'
    await nextTick()
    expect(mounted.host.textContent).toBe('b')
    mounted.unmount()
  })

  it('state.show = true 后 cond 节点出现', async () => {
    const state = { show: false }
    const mounted = mountVario(
      { type: 'div', children: [{ type: 'span', cond: '{{ show }}', children: 'visible' }] },
      state
    )
    await nextTick()
    expect(mounted.host.textContent).not.toContain('visible')
    ;(mounted.api().state as { show: boolean }).show = true
    await nextTick()
    expect(mounted.host.textContent).toContain('visible')
    mounted.unmount()
  })

  it('state.list.push() 后 {{ list.length }} 更新', async () => {
    const state = { list: [1, 2] }
    const mounted = mountVario(
      { type: 'div', children: '{{ list.length }}' },
      state
    )
    await nextTick()
    expect(mounted.host.textContent).toBe('2')
    ;(mounted.api().state as { list: number[] }).list.push(3)
    await nextTick()
    expect(mounted.host.textContent).toBe('3')
    mounted.unmount()
  })

  it('_set("items.0.name") 后 {{ items[0].name }} 更新', async () => {
    const state = { items: [{ name: 'x' }, { name: 'y' }] }
    const mounted = mountVario(
      { type: 'div', children: '{{ items[0].name }}' },
      state
    )
    await nextTick()
    expect(mounted.host.textContent).toBe('x')
    mounted.api().ctx.value._set('items.0.name', 'z')
    await nextTick()
    expect(mounted.host.textContent).toBe('z')
    mounted.unmount()
  })

  it('_set("form", {...}) 整体替换后 {{ form.name }} 更新', async () => {
    const state = { form: { name: 'old' } }
    const mounted = mountVario(
      { type: 'div', children: '{{ form.name }}' },
      state
    )
    await nextTick()
    expect(mounted.host.textContent).toBe('old')
    mounted.api().ctx.value._set('form', { name: 'new' })
    await nextTick()
    expect(mounted.host.textContent).toBe('new')
    mounted.unmount()
  })

  it('state 初始 {} 后赋 state.form.email 仍能触发依赖 effect', async () => {
    const state = {}
    const mounted = mountVario(
      { type: 'div', children: '{{ form.email }}' },
      state
    )
    await nextTick()
    expect(mounted.host.textContent).toBe('')
    ;(mounted.api().state as Record<string, unknown>).form = { email: 'x' }
    await nextTick()
    expect(mounted.host.textContent).toBe('x')
    mounted.unmount()
  })
})

describe('AC-2 真实节奏事件（10ms 间隔三连点）', () => {
  it('按 10ms 间隔连点三次 state.count++ 显示 1,2,3', async () => {
    const state = { count: 0 }
    const mounted = mountVario(
      {
        type: 'div',
        children: [
          { type: 'button', events: { click: [{ type: 'set', path: 'count', value: '{{ count + 1 }}' }] } },
          { type: 'span', children: '{{ count }}' }
        ]
      },
      state
    )
    await nextTick()
    expect(mounted.host.textContent).toContain('0')
    const btn = mounted.host.querySelector('button')!
    for (const expected of ['1', '2', '3']) {
      btn.click()
      await nextTick()
      expect(mounted.host.textContent).toContain(expected)
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    mounted.unmount()
  })
})
