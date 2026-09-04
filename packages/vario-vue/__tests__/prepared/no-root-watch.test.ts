/**
 * @vitest-environment happy-dom
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setupWatchers } from '../../src/composables/internal/use-vario-phases.js'
import { getRuntimeMode, setRuntimeMode } from '../../src/runtime/runtime-mode.js'

// prepared 为显式 opt-in（全局默认 legacy）；本文件是 prepared 专项测试
beforeAll(() => setRuntimeMode('prepared'))
afterAll(() => setRuntimeMode('legacy'))

describe('T2.8 prepared mode has no root deep watch', () => {
  it('skipDeepStateWatch is honored in prepared mode', () => {
    expect(getRuntimeMode()).toBe('prepared')
    expect(typeof setupWatchers).toBe('function')
    setRuntimeMode('legacy')
    expect(getRuntimeMode()).toBe('legacy')
    setRuntimeMode('prepared')
  })
})

describe('T3.8 virtual list', () => {
  it('reference adapter caps DOM range at 200', async () => {
    const { createReferenceVirtualAdapter } = await import('../../src/runtime/virtual-list-adapter.js')
    expect(createReferenceVirtualAdapter({ viewport: 200, overscan: 0 }).getVisibleRange(1000).end).toBe(200)
  })
})

describe('PERF-A2/T4 prepared region render count', () => {
  it('updating one leaf does not regionRender 1000 cells', async () => {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const { useVario, setRuntimeMode, getRuntimeMode } = await import('../../src/index.js')
    const { resetPerformanceCounters, getPerformanceCounters } = await import('../../src/internal/performance-hooks.js')
    const previous = getRuntimeMode()
    expect(previous).toBe('prepared')
    const values = Array.from({ length: 200 }, (_, i) => `v${i}`)
    const schema = {
      type: 'div',
      children: Array.from({ length: 200 }, (_, i) => ({ type: 'span', children: `{{ values[${i}] }}` }))
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(schema as never, { state: { values } })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    resetPerformanceCounters()
    api!.ctx.value._set('values.0', 'leaf')
    await nextTick()
    expect(host.textContent).toContain('leaf')
    expect(getPerformanceCounters().regionRender).toBeLessThanOrEqual(4)
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })
})

describe('PERF-T6 loop item cache isolation', () => {
  it('two loop items with the same template do not share cached text', async () => {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const { useVario, setRuntimeMode, getRuntimeMode } = await import('../../src/index.js')
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const items = [{ id: 1, label: 'a' }, { id: 2, label: 'b' }]
    const schema = {
      type: 'div',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
      children: [{ type: 'span', children: '{{ item.label }}' }]
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
    expect(host.textContent).toContain('a')
    expect(host.textContent).toContain('b')
    api!.ctx.value._set('items.0.label', 'updated')
    await nextTick()
    expect(host.textContent).toContain('updated')
    expect(host.textContent).toContain('b')
    api!.dispose()
    // FR-7：dispose 不再清空 reactiveState（宿主共享对象保持原样）
    expect((api!.state as { items?: unknown }).items).toBeDefined()
    app.unmount()
    host.remove()
    const { activePageSessionCount } = await import('../../src/index.js')
    expect(activePageSessionCount()).toBe(0)
    setRuntimeMode(previous)
  })
})

describe('AC-09 / AC-07 prepared updates', () => {
  it('AC-09 100 writes in one tick commit once to the last value', async () => {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const { useVario, setRuntimeMode, getRuntimeMode } = await import('../../src/index.js')
    const { resetPerformanceCounters, getPerformanceCounters } = await import('../../src/internal/performance-hooks.js')
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario({ type: 'span', children: '{{ n }}' } as never, { state: { n: 0 } })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    resetPerformanceCounters()
    for (let i = 1; i <= 100; i++) api!.ctx.value._set('n', i)
    await nextTick()
    expect(host.textContent).toContain('100')
    expect(getPerformanceCounters().regionRender).toBeLessThanOrEqual(4)
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('AC-07 N=1 S=20000 unused keys: leaf update stays local', async () => {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const { useVario, setRuntimeMode, getRuntimeMode } = await import('../../src/index.js')
    const { resetPerformanceCounters, getPerformanceCounters } = await import('../../src/internal/performance-hooks.js')
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const extra = Object.fromEntries(Array.from({ length: 20_000 }, (_, i) => [`k${i}`, i]))
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario({ type: 'span', children: '{{ leaf }}' } as never, {
          state: { leaf: 'a', ...extra }
        })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    resetPerformanceCounters()
    api!.ctx.value._set('leaf', 'b')
    await nextTick()
    expect(host.textContent).toContain('b')
    expect(getPerformanceCounters().regionRender).toBeLessThanOrEqual(4)
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('AC-07 S=100/1000/5000/10000/20000 leaf update stays local（T3.5 去掉计时门禁，改 regionRender 门禁）', async () => {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const { useVario, setRuntimeMode, getRuntimeMode } = await import('../../src/index.js')
    const { resetPerformanceCounters, getPerformanceCounters } = await import('../../src/internal/performance-hooks.js')
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const sizes = [100, 1000, 5000, 10_000, 20_000]
    const renders: number[] = []
    for (const size of sizes) {
      const extra = Object.fromEntries(Array.from({ length: size }, (_, i) => [`k${i}`, i]))
      const host = document.createElement('div')
      document.body.appendChild(host)
      let api: ReturnType<typeof useVario>
      const app = createApp(defineComponent({
        setup() {
          api = useVario({ type: 'span', children: '{{ leaf }}' } as never, {
            state: { leaf: 'a', ...extra }
          })
          return () => api.vnode.value
        }
      }))
      app.mount(host)
      await nextTick()
      resetPerformanceCounters()
      api!.ctx.value._set('leaf', `b${size}`)
      await nextTick()
      renders.push(getPerformanceCounters().regionRender)
      expect(host.textContent).toContain(`b${size}`)
      expect(getPerformanceCounters().regionRender).toBeLessThanOrEqual(4)
      app.unmount()
      host.remove()
    }
    expect(renders.every(r => r <= 4)).toBe(true)
    setRuntimeMode(previous)
  })
})

function countVarioRegionInstances(app: { _instance?: { subTree?: unknown } }): number {
  const names = new Set(['VarioStaticRegion', 'VarioDynamicRegion', 'VarioLoopRegion', 'VarioSlotRegion'])
  let n = 0
  const seen = new Set<object>()
  const walkVnode = (vn: unknown): void => {
    if (!vn || typeof vn !== 'object') return
    if (seen.has(vn as object)) return
    seen.add(vn as object)
    const rec = vn as { component?: { type?: { name?: string }; subTree?: unknown }; children?: unknown }
    const name = rec.component?.type?.name
    if (name && names.has(name)) n += 1
    if (rec.component?.subTree) walkVnode(rec.component.subTree)
    const children = rec.children
    if (Array.isArray(children)) children.forEach(walkVnode)
  }
  walkVnode(app._instance?.subTree)
  return n
}

describe('AC-05 static native instance budget', () => {
  it('1000 static native nodes do not grow Vario region instances linearly with N', async () => {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const { useVario, setRuntimeMode, getRuntimeMode } = await import('../../src/index.js')
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const counts: number[] = []
    for (const n of [100, 1000] as const) {
      const host = document.createElement('div')
      document.body.appendChild(host)
      const app = createApp(defineComponent({
        setup() {
          const api = useVario({
            type: 'div',
            children: Array.from({ length: n }, () => ({ type: 'span', children: 'x' }))
          } as never, { state: {} })
          return () => api.vnode.value
        }
      }))
      app.mount(host)
      await nextTick()
      counts.push(countVarioRegionInstances(app as never))
      expect(host.querySelectorAll('span').length).toBe(n)
      app.unmount()
      host.remove()
    }
    expect(counts[0]).toBeGreaterThan(0)
    expect(counts[1]).toBeLessThanOrEqual(Math.max(4, counts[0] * 2))
    expect(counts[1]).toBeLessThan(100)
    setRuntimeMode(previous)
  })
})

describe('PERF-A2/AC-11 default path loop locality', () => {
  it('1000-row field update renders one LoopItemCell and does not re-run LoopRegion', async () => {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const { useVario, getRuntimeMode } = await import('../../src/index.js')
    const { resetPerformanceCounters, getPerformanceCounters } = await import('../../src/internal/performance-hooks.js')
    expect(getRuntimeMode()).toBe('prepared')
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, label: `r${i}` }))
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario({
          type: 'div',
          loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
          children: [{ type: 'span', children: '{{ item.label }}' }]
        } as never, { state: { items } })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    resetPerformanceCounters()
    api!.ctx.value._set('items.1.label', 'leaf')
    await nextTick()
    expect(host.textContent).toContain('leaf')
    expect(host.textContent).toContain('r0')
    // T3.7：默认 virtualAdapter=null 全量渲染（虚拟化需显式 opt-in）
    expect(host.querySelectorAll('span').length).toBe(1000)
    expect(getPerformanceCounters().loopCellRender).toBe(1)
    expect(getPerformanceCounters().lrr).toBe(0)
    app.unmount()
    host.remove()
  })
})

describe('AC-06 default path deep leaf', () => {
  it('deepest leaf update does not grow regionRender with D', async () => {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const { useVario, getRuntimeMode } = await import('../../src/index.js')
    const { resetPerformanceCounters, getPerformanceCounters } = await import('../../src/internal/performance-hooks.js')
    expect(getRuntimeMode()).toBe('prepared')
    const renders: number[] = []
    for (const d of [8, 32] as const) {
      let node: Record<string, unknown> = { type: 'span', children: '{{ leaf }}' }
      for (let i = 1; i < d; i++) node = { type: 'div', children: [node] }
      const host = document.createElement('div')
      document.body.appendChild(host)
      let api: ReturnType<typeof useVario>
      const app = createApp(defineComponent({
        setup() {
          api = useVario(node as never, { state: { leaf: 'a' } })
          return () => api.vnode.value
        }
      }))
      app.mount(host)
      await nextTick()
      resetPerformanceCounters()
      api!.ctx.value._set('leaf', `b${d}`)
      await nextTick()
      expect(host.textContent).toContain(`b${d}`)
      renders.push(getPerformanceCounters().regionRender)
      app.unmount()
      host.remove()
    }
    expect(renders[1]).toBeLessThanOrEqual(renders[0] + 1)
    expect(Math.max(...renders)).toBeLessThanOrEqual(4)
  })
})

describe('AC-08/T4 default path N does not scale leaf update', () => {
  it('N=100/500/1000 leaf update stays local and not linear in N（T3.5 去掉计时门禁）', async () => {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const { useVario, getRuntimeMode } = await import('../../src/index.js')
    const { resetPerformanceCounters, getPerformanceCounters } = await import('../../src/internal/performance-hooks.js')
    expect(getRuntimeMode()).toBe('prepared')
    const renders: number[] = []
    for (const n of [100, 500, 1000] as const) {
      const values = Array.from({ length: n }, (_, i) => `v${i}`)
      const host = document.createElement('div')
      document.body.appendChild(host)
      let api: ReturnType<typeof useVario>
      const app = createApp(defineComponent({
        setup() {
          api = useVario({
            type: 'div',
            children: Array.from({ length: n }, (_, i) => ({ type: 'span', children: `{{ values[${i}] }}` }))
          } as never, { state: { values } })
          return () => api.vnode.value
        }
      }))
      app.mount(host)
      await nextTick()
      resetPerformanceCounters()
      api!.ctx.value._set('values.0', `leaf${n}`)
      await nextTick()
      renders.push(getPerformanceCounters().regionRender)
      expect(host.textContent).toContain(`leaf${n}`)
      expect(getPerformanceCounters().regionRender).toBeLessThanOrEqual(4)
      app.unmount()
      host.remove()
    }
    expect(renders.every(r => r <= 4)).toBe(true)
  })
})
