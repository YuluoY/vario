/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：作用域插槽 ctx 与 loop ctx 解耦（AC-4）
 *
 * - 循环内作用域插槽输出 A|A|0、B|B|1（scope.row.name|$item.name|$index）
 * - 循环外插槽内 ref 不是数组
 */

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'
import { useVario } from '../../src/index.js'

describe('AC-4 作用域插槽与循环解耦', () => {
  it('循环内插槽 scope.row.name|$item.name|$index 指向外层循环项', async () => {
    // 用一个组件承载作用域插槽：传入 scope = { row: { name: item.name } }
    const Scoped = defineComponent({
      name: 'ScopedSlot',
      setup(_, { slots }) {
        return () => slots.default?.({ row: { name: 'scoped-value' } })
      }
    })
    const items = [{ name: 'A' }, { name: 'B' }]
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            children: [{
              type: 'ScopedSlot',
              children: [{
                type: 'template',
                slot: 'default',
                props: { scope: 'scope' },
                children: '{{ scope.row.name }}|{{ $item.name }}|{{ $index }}'
              }]
            }],
            loop: { items: 'items', itemKey: '$item', indexKey: '$index' }
          } as never,
          { state: { items } as never }
        )
        return () => api.vnode.value
      }
    }))
    app.component('ScopedSlot', Scoped)
    app.mount(host)
    await nextTick()
    expect(host.textContent).toContain('scoped-value|A|0')
    expect(host.textContent).toContain('scoped-value|B|1')
    app.unmount()
    host.remove()
  })

  it('循环外插槽内 ref 不是数组', async () => {
    const Scoped = defineComponent({
      name: 'ScopedRefSlot',
      setup(_, { slots }) {
        return () => slots.default?.({ row: { name: 'x' } })
      }
    })
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            children: [{
              type: 'ScopedRefSlot',
              children: [{
                type: 'template',
                slot: 'default',
                props: { scope: 'scope' },
                children: [{ type: 'span', ref: 'label', children: '{{ scope.row.name }}' }]
              }]
            }]
          } as never,
          { state: {} as never }
        )
        return () => api.vnode.value
      }
    }))
    app.component('ScopedRefSlot', Scoped)
    app.mount(host)
    await nextTick()
    await nextTick()
    expect(host.textContent).toContain('x')
    const labelRef = (api.refs as Record<string, { value: unknown }>).label
    expect(labelRef).toBeDefined()
    const labelValue = labelRef.value
    expect(Array.isArray(labelValue)).toBe(false)
    expect((labelValue as HTMLElement).tagName).toBe('SPAN')
    app.unmount()
    host.remove()
  })
})
