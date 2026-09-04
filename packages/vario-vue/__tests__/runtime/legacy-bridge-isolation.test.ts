/**
 * @vitest-environment happy-dom
 * T4.2 门禁：legacy 模式不走 prepared 的 bridge 路由
 * （VueStateBridge.apply 在 legacy 下必须 0 次调用——token 驱动是 prepared 专属）
 */
import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'
import { useVario, setRuntimeMode, getRuntimeMode } from '../../src/index.js'
import { VueStateBridge } from '../../src/runtime/state-bridge.js'

describe('T4.2 legacy bridge isolation', () => {
  it('legacy mode never calls VueStateBridge.apply', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('legacy')
    let calls = 0
    const orig = VueStateBridge.prototype.apply
    VueStateBridge.prototype.apply = function (...args: unknown[]) {
      calls++
      return (orig as (...a: unknown[]) => void).apply(this, args)
    }
    try {
      const state = { n: 0 }
      const host = document.createElement('div')
      document.body.appendChild(host)
      let api!: ReturnType<typeof useVario>
      const app = createApp(defineComponent({
        setup() {
          api = useVario({ type: 'span', children: '{{ n }}' } as never, { state: state as never })
          return () => api.vnode.value
        }
      }))
      app.mount(host)
      await nextTick()
      api.ctx.value._set('n', 5)
      ;(api.state as { n: number }).n = 6
      await nextTick()
      expect(host.textContent).toContain('6')
      app.unmount()
      host.remove()
    } finally {
      VueStateBridge.prototype.apply = orig
    }
    expect(calls).toBe(0)
    setRuntimeMode(previous)
  })
})
