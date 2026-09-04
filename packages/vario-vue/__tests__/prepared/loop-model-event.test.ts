/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, nextTick, h, ref, getCurrentInstance } from 'vue'
import { useVario, getRuntimeMode, setRuntimeMode, createReferenceVirtualAdapter } from '../../src/index.js'

describe('T3.6 loop model and event', () => {
  it('model writeback stays on the edited item', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const items = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bob' }]
    const schema = {
      type: 'div',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
      children: [{ type: 'span', children: '{{ item.name }}' }]
    }
    const names: string[] = []
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(schema as never, {
          state: { items },
          diagnosticSink: { emit(event) { names.push(event.name) } }
        })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(host.textContent).toContain('Ada')
    expect(host.textContent).toContain('Bob')
    expect(names).toContain('render-loop')
    expect(names).toContain('render-mount')
    expect(names).toContain('schema-prepare')
    api!.ctx.value._set('items.0.name', 'Ada2')
    await nextTick()
    expect(host.textContent).toContain('Ada2')
    expect(host.textContent).toContain('Bob')
    api!.ctx.value._set('items', [items[1], items[0]])
    await nextTick()
    expect(host.textContent).toMatch(/Bob.*Ada2/)
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('AC-13 reorder keeps item-key local state and instance uid', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const uids = new Map<string, number | undefined>()
    const setups: string[] = []
    const Counter = defineComponent({
      name: 'ItemCounter',
      props: { itemId: { type: [String, Number], required: true } },
      setup(props: { itemId: string | number }) {
        const n = ref(0)
        uids.set(String(props.itemId), getCurrentInstance()?.uid)
        setups.push(`${props.itemId}:${getCurrentInstance()?.uid}`)
        return () => h('button', {
          'data-id': String(props.itemId),
          onClick: () => { n.value += 1 }
        }, `${props.itemId}:${n.value}`)
      }
    })
    const items = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bob' }]
    const schema = {
      type: 'ItemCounter',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
      props: { itemId: '{{ item.id }}' }
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(schema as never, { state: { items }, components: { ItemCounter: Counter } })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    const ada = host.querySelector('[data-id="1"]') as HTMLButtonElement | null
    expect(ada).toBeTruthy()
    ada!.click()
    await nextTick()
    expect(ada!.textContent).toBe('1:1')
    const uidBefore = uids.get('1')
    api!.ctx.value._set('items', [items[1], items[0]])
    await nextTick()
    const adaAfter = host.querySelector('[data-id="1"]') as HTMLButtonElement | null
    expect(adaAfter?.textContent).toBe('1:1')
    expect((host.querySelector('[data-id="2"]') as HTMLButtonElement | null)?.textContent).toBe('2:0')
    expect(uids.get('1')).toBe(uidBefore)
    expect(setups.filter(s => s.startsWith('1:'))).toHaveLength(1)
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('T3.5 updating one item only re-renders that LoopItemCell', async () => {
    const { resetPerformanceCounters, getPerformanceCounters } = await import('../../src/internal/performance-hooks.js')
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const items = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'c', n: 3 }]
    const schema = {
      type: 'div',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
      children: [{ type: 'span', children: '{{ item.n }}' }]
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(schema as never, { state: { items } })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(host.textContent).toContain('1')
    resetPerformanceCounters()
    api!.ctx.value._set('items.1.n', 9)
    await nextTick()
    expect(host.textContent).toContain('9')
    expect(getPerformanceCounters().loopCellRender).toBe(1)
    expect(getPerformanceCounters().lrr).toBe(0)
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('loop correctness at 100/500/1000 item scales', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    for (const size of [100, 500, 1000] as const) {
      const items = Array.from({ length: size }, (_, i) => ({ id: i, n: i }))
      const schema = {
        type: 'div',
        loop: { items: 'items', itemKey: 'item', key: 'id' },
        children: [{ type: 'span', children: '{{ item.n }}' }]
      }
      const host = document.createElement('div')
      document.body.appendChild(host)
      let api: ReturnType<typeof useVario>
      const app = createApp(defineComponent({
        setup() {
          api = useVario(schema as never, { state: { items } })
          return () => api.vnode.value
        }
      }))
      app.mount(host)
      await nextTick()
      const spans = host.querySelectorAll('span')
      // T3.7：默认 virtualAdapter=null，全量渲染不截断（原 ≤204 截断为固化错误行为）
      expect(spans.length).toBe(size)
      // 更新可见首项，只有目标 cell 文本变化
      api!.ctx.value._set('items.0.n', -1)
      await nextTick()
      expect(host.querySelectorAll('span')[0]?.textContent).toBe('-1')
      expect(host.querySelectorAll('span')[1]?.textContent).toBe('1')
      app.unmount()
      host.remove()
    }
    setRuntimeMode(previous)
  })

  it('runtime emits loop-large-list for 100+ expression items', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const names: string[] = []
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, n: i }))
    const schema = {
      type: 'div',
      loop: { items: 'items', itemKey: 'item', key: 'id' },
      children: [{ type: 'span', children: '{{ item.n }}' }]
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(schema as never, {
          state: { items },
          diagnosticSink: { emit(event) { names.push(event.name) } }
        })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(names).toContain('loop-large-list')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('T3.8 virtual window keeps document order, focus, and host restoreAnchor', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
    let anchored: string | number | undefined
    const ranged = createReferenceVirtualAdapter({ viewport: 20, overscan: 0 })
    const adapter = {
      getVisibleRange: (input: Parameters<typeof ranged.getVisibleRange>[0]) => ranged.getVisibleRange(input),
      onItemsChanged() {},
      restoreAnchor(key: string | number) { anchored = key }
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario({
          type: 'button',
          loop: { items: 'items', itemKey: 'item', key: 'id' },
          props: { 'data-id': '{{ item.id }}' },
          children: '{{ item.id }}'
        } as never, {
          state: { items },
          virtualAdapter: adapter
        })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    const buttons = [...host.querySelectorAll('button')] as HTMLButtonElement[]
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.length).toBeLessThanOrEqual(20)
    expect(buttons.map(el => el.getAttribute('data-id'))).toEqual(
      Array.from({ length: buttons.length }, (_, i) => String(i))
    )
    buttons[0].focus()
    expect(document.activeElement).toBe(buttons[0])
    adapter.restoreAnchor('0')
    expect(anchored).toBe('0')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })
})
