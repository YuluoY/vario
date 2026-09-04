/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：SSR ctx 复用与 engine 生命周期（AC-11 / T3.8）
 *
 * - hydrateVarioApp 后 _set 不抛 Session disposed
 * - 连续挂载/卸载 100 次 engines Map 大小不变
 * - 多页面共享 engineId 时单页 dispose 不清空 materials
 */

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createRuntimeContext, getOrCreateEngine, registerEngineMaterial } from '@variojs/core'
import { useVario } from '../../src/index.js'

describe('AC-11 SSR ctx 复用', () => {
  it('hydrateVarioApp 后 _set 不抛 Session disposed', async () => {
    const { renderSsrToString, hydrateVarioApp } = await import('../../src/ssr/create-ssr-session.js')
    const ctx = createRuntimeContext({ title: 'ssr' })
    const schema = {
      type: 'div',
      children: [{ type: 'span', children: '{{ title }}' }]
    }
    const html = await renderSsrToString(schema as never, ctx)
    expect(html).toContain('ssr')
    // hydrate 需要真实元素（Vue 以 container.hasChildNodes() 判定 hydrate 模式）
    const container = document.createElement('div')
    document.body.appendChild(container)
    const { app, session } = await hydrateVarioApp(container, schema as never, ctx)
    expect(() => ctx._set('title', 'hydrated')).not.toThrow()
    expect(ctx._get('title')).toBe('hydrated')
    app.unmount()
    session.dispose()
    container.remove()
  })
})

describe('AC-11 engine 生命周期', () => {
  it('连续挂载/卸载 100 次后 default engine 会话表归零', async () => {
    const engine = getOrCreateEngine('default')
    for (let i = 0; i < 100; i++) {
      const host = document.createElement('div')
      document.body.appendChild(host)
      let api!: ReturnType<typeof useVario>
      const app = createApp(defineComponent({
        setup() {
          api = useVario(
            { type: 'div', children: 'x' } as never,
            { state: {} as never }
          )
          return () => api.vnode.value
        }
      }))
      app.mount(host)
      await nextTick()
      app.unmount()
      host.remove()
    }
    expect(engine.sessions.size).toBe(0)
  })

  it('多页面共享 engineId 时单页 dispose 不清空 materials', async () => {
    registerEngineMaterial('shared-engine', { name: 'SharedWidget', version: '1.0.0' })
    const engine = getOrCreateEngine('shared-engine')
    const mountOnce = async () => {
      const host = document.createElement('div')
      document.body.appendChild(host)
      let api!: ReturnType<typeof useVario>
      const app = createApp(defineComponent({
        setup() {
          api = useVario(
            { type: 'div', children: 'x' } as never,
            { state: {} as never, engineId: 'shared-engine' }
          )
          return () => api.vnode.value
        }
      }))
      app.mount(host)
      await nextTick()
      app.unmount()
      host.remove()
    }
    await mountOnce()
    expect(engine.materials.size).toBeGreaterThan(0)
    await mountOnce()
    await mountOnce()
    expect(engine.materials.size).toBeGreaterThan(0)
  })
})
