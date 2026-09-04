/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：prepared 变更路由补全（AC-8 / FR-12）
 *
 * - {{ list.slice(0,5) }} 循环在 _set('list') 后刷新
 * - model: 'form.name' 在 _set('form.name') 后刷新
 * - 直接改 state 刷新（deepStateWatch 默认开启）
 */

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'
import { useVario, getRuntimeMode, setRuntimeMode } from '../../src/index.js'

describe('AC-8 prepared 变更路由', () => {
  it('{{ list.slice(0,5) }} 循环在 _set("list") 后刷新', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const state = { list: [1, 2, 3, 4, 5, 6] }
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            loop: { items: '{{ list.slice(0,5) }}', itemKey: 'item' },
            children: [{ type: 'span', children: '{{ item }}' }]
          } as never,
          { state: state as never }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(host.querySelectorAll('span').length).toBe(5)
    api.ctx.value._set('list', [9, 8, 7, 6, 5, 4, 3, 2, 1])
    await nextTick()
    const texts = Array.from(host.querySelectorAll('span')).map(s => s.textContent)
    expect(texts).toEqual(['9', '8', '7', '6', '5'])
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('model: "form.name" 在 _set("form.name") 后刷新', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const state = { form: { name: 'old' } }
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            children: [
              { type: 'input', model: 'form.name' },
              { type: 'span', children: '{{ form.name }}' }
            ]
          } as never,
          { state: state as never }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    const input = host.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('old')
    api.ctx.value._set('form.name', 'new')
    await nextTick()
    expect((host.querySelector('input') as HTMLInputElement).value).toBe('new')
    expect(host.textContent).toContain('new')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('直接改 state 后视图刷新（deepStateWatch 默认开启）', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const state = { count: 0, list: [1, 2] }
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            children: [
              { type: 'span', children: '{{ count }}' },
              { type: 'b', children: '{{ list.length }}' }
            ]
          } as never,
          { state: state as never }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(host.textContent).toContain('0')
    expect(host.textContent).toContain('2')
    ;(api.state as { count: number }).count = 41
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(host.textContent).toContain('41')
    ;(api.state as { list: number[] }).list.push(3)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(host.textContent).toContain('3')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })
})
