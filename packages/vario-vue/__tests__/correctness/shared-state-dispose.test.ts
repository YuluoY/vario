/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：dispose 不破坏宿主共享对象（AC-7）
 *
 * - v-if 卸载使用共享 reactive state 的组件后对象内容不变、可重挂载
 * - 卸载后飞行中的异步 method 回写不抛未捕获异常，emit SESSION_DISPOSED_WRITE
 */

import { describe, it, expect, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, reactive, ref } from 'vue'
import { useVario } from '../../src/index.js'

describe('AC-7 dispose 不破坏宿主对象', () => {
  it('v-if 卸载后共享 reactive state 内容不变，可重新挂载显示原值', async () => {
    const shared = reactive({ count: 41, label: 'keep' })
    const show = ref(true)
    let api: ReturnType<typeof useVario> | null = null

    const VarioPanel = defineComponent({
      setup() {
        const result = useVario(
          { type: 'div', children: '{{ count }}-{{ label }}' } as never,
          { state: shared as never }
        )
        api = result
        return () => result.vnode.value
      }
    })

    const app = createApp(defineComponent({
      setup() {
        return () => (show.value ? h(VarioPanel) : h('div', 'fallback'))
      }
    }))
    const host = document.createElement('div')
    document.body.appendChild(host)
    app.mount(host)
    await nextTick()
    expect(host.textContent).toBe('41-keep')

    // 卸载使用共享 state 的组件
    show.value = false
    await nextTick()
    await nextTick()

    // 共享对象内容不变（不被 dispose 清空）
    expect(shared.count).toBe(41)
    expect(shared.label).toBe('keep')
    expect(Object.keys(shared).sort()).toEqual(['count', 'label'])

    // 重新挂载显示原值
    show.value = true
    await nextTick()
    await nextTick()
    expect(host.textContent).toBe('41-keep')
    app.unmount()
    host.remove()
    expect(shared.count).toBe(41)
    expect(shared.label).toBe('keep')
  })

  it('卸载后飞行中的异步 method 回写不抛未捕获异常并 emit SESSION_DISPOSED_WRITE', async () => {
    const events: Array<string | undefined> = []
    const unhandled = vi.fn()
    const onUnhandled = (e: unknown) => { unhandled(e) }
    process.on('unhandledRejection', onUnhandled)

    const shared = reactive({ result: 0 })
    let api: ReturnType<typeof useVario> | null = null

    const VarioPanel = defineComponent({
      setup() {
        api = useVario(
          {
            type: 'div',
            children: [
              { type: 'button', events: { click: 'slowWrite' } },
              { type: 'span', children: '{{ result }}' }
            ]
          } as never,
          {
            state: shared as never,
            diagnosticSink: { emit(event) { events.push(event.diagnostic?.code) } },
            methods: {
              slowWrite: ({ ctx }: { ctx: { _set: (p: string, v: unknown) => void } }) => {
                return new Promise<void>(resolve => {
                  setTimeout(() => {
                    // 回写走 ctx._set（FR-7 的 disposed 写入语义覆盖此路径）
                    ctx._set('result', 99)
                    resolve()
                  }, 30)
                })
              }
            }
          }
        )
        return () => api!.vnode.value
      }
    })

    const show = ref(true)
    const app = createApp(defineComponent({
      setup() {
        return () => (show.value ? h(VarioPanel) : h('div', 'off'))
      }
    }))
    const host = document.createElement('div')
    document.body.appendChild(host)
    app.mount(host)
    await nextTick()

    host.querySelector('button')!.click()
    // 立即卸载，让回写落在飞行中
    show.value = false
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 60))

    expect(unhandled).not.toHaveBeenCalled()
    expect(events).toContain('SESSION_DISPOSED_WRITE')
    process.off('unhandledRejection', onUnhandled)
    app.unmount()
    host.remove()
  })
})
