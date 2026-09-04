/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：legacy 指令持续生效（AC-6）
 *
 * - directive hook 序列 mounted → updated → updated → unmounted
 * - 无 withDirectives 警告（scheduler 渲染必须发生在 render 函数内）
 * - 一次 _set 只触发一次 Vario 渲染
 */

import { describe, it, expect, vi } from 'vitest'
import { createApp, defineComponent, nextTick, type Directive } from 'vue'
import { useVario } from '../../src/index.js'

describe('AC-6 legacy 指令生命周期', () => {
  it('hook 序列 mounted:0 → updated:1 → updated:2 → unmounted，无 withDirectives 警告', async () => {
    const hooks: string[] = []
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const vLoading: Directive = {
        mounted(el, binding) {
          hooks.push(`mounted:${binding.value}`)
        },
        updated(el, binding) {
          hooks.push(`updated:${binding.value}`)
        },
        unmounted() {
          hooks.push('unmounted')
        }
      }
      const state = { loading: 0 }
      const host = document.createElement('div')
      document.body.appendChild(host)
      let api!: ReturnType<typeof useVario>
      const app = createApp(defineComponent({
        setup() {
          api = useVario(
            {
              type: 'div',
              directives: { loading: '{{ loading }}' },
              children: 'text'
            } as never,
            { state: state as never, directives: { loading: vLoading } }
          )
          return () => api.vnode.value
        }
      }))
      app.mount(host)
      await nextTick()
      expect(hooks).toEqual(['mounted:0'])

      api.ctx.value._set('loading', 1)
      await nextTick()
      await nextTick()
      expect(hooks).toEqual(['mounted:0', 'updated:1'])

      api.ctx.value._set('loading', 2)
      await nextTick()
      await nextTick()
      expect(hooks).toEqual(['mounted:0', 'updated:1', 'updated:2'])

      app.unmount()
      await nextTick()
      expect(hooks).toEqual(['mounted:0', 'updated:1', 'updated:2', 'unmounted'])
      host.remove()

      const withDirectivesWarnings = warnSpy.mock.calls.filter(
        c => String(c[0]).includes('withDirectives')
      )
      expect(withDirectivesWarnings).toHaveLength(0)
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('一次 _set 只触发一次 renderer.render', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          { type: 'div', children: '{{ count }}' } as never,
          { state: { count: 0 } as never }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()

    const { getPerformanceCounters, resetPerformanceCounters } = await import('../../src/internal/performance-hooks.js')
    // 两次完全相同的 _set：单次渲染的节点计数必须一致（双渲染会翻倍）
    resetPerformanceCounters()
    api.ctx.value._set('count', 5)
    await nextTick()
    await nextTick()
    const first = getPerformanceCounters().legacyRenderNode ?? 0
    expect(host.textContent).toBe('5')

    resetPerformanceCounters()
    api.ctx.value._set('count', 6)
    await nextTick()
    await nextTick()
    const second = getPerformanceCounters().legacyRenderNode ?? 0
    expect(host.textContent).toBe('6')
    expect(first).toBeGreaterThan(0)
    expect(second).toBe(first)
    app.unmount()
    host.remove()
  })
})
