/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { VueRenderer } from '../../src/renderer.js'
import { createRuntimeContext } from '@variojs/core'
import { VarioLifecycleBoundary } from '../../src/components/lifecycle-boundary.js'

describe('T0.5 lifecycle identity', () => {
  it('update keeps the same lifecycle boundary type', () => {
    const ctx = createRuntimeContext({})
    const renderer = new VueRenderer()
    const schema = { type: 'div', onMounted: 'boot', children: 'x' }
    const a = renderer.render(schema as never, ctx)
    const b = renderer.render(schema as never, ctx)
    expect(a?.type).toEqual(b?.type)
    expect(VarioLifecycleBoundary.name || (VarioLifecycleBoundary as { name?: string }).name).toBeTruthy()
  })

  it('AC-14 one ordinary update: mounted=1 unmounted=0 updated=1', async () => {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const { useVario, getRuntimeMode, setRuntimeMode } = await import('../../src/index.js')
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const counts = { mounted: 0, unmounted: 0, updated: 0 }
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario({ type: 'div', onMounted: 'm', onUpdated: 'u', onUnmounted: 'um', children: '{{ n }}' } as never, {
          state: { n: 1 },
          methods: {
            m: () => { counts.mounted += 1 },
            u: () => { counts.updated += 1 },
            um: () => { counts.unmounted += 1 }
          }
        })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(counts.mounted).toBe(1)
    expect(counts.unmounted).toBe(0)
    api!.ctx.value._set('n', 2)
    await nextTick()
    expect(host.textContent).toContain('2')
    expect(counts.mounted).toBe(1)
    expect(counts.updated).toBe(1)
    expect(counts.unmounted).toBe(0)
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })

  it('onActivated/onDeactivated nodes wrap with the same lifecycle boundary', async () => {
    const { lifecyclePlugin } = await import('../../src/plugins/lifecycle.js')
    const ctx = createRuntimeContext({})
    const activated = lifecyclePlugin.wrapComponent('div', {}, 'x', { type: 'div', onActivated: 'resume' } as never, ctx)
    const deactivated = lifecyclePlugin.wrapComponent('div', {}, 'x', { type: 'div', onDeactivated: 'pause' } as never, ctx)
    expect(activated?.type).toBe(VarioLifecycleBoundary)
    expect(deactivated?.type).toBe(VarioLifecycleBoundary)
  })
})
