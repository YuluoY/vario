/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：事件会话生命周期（AC-1 vue 集成）
 *
 * - 短超时事件结束后（超时窗口已过）v-model 写回与 _set 正常
 * - 两个交叠异步事件完成后 frames.size 回到事件前
 * - 真实节奏（setTimeout 间隔）版本
 */

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { useVario, getPageSessionForContext } from '../../src/index.js'

/** 组件 v-model 输入框：emit('update:modelValue', string) */
const VarioInput = defineComponent({
  name: 'VarioInput',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', {
      value: props.modelValue,
      onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value)
    })
  }
})

function mount(schema: unknown, options: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  let api!: ReturnType<typeof useVario>
  const app = createApp(defineComponent({
    setup() {
      api = useVario(schema as never, options as never)
      return () => api.vnode.value
    }
  }))
  app.component('VarioInput', VarioInput)
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

describe('AC-1 事件会话超时后写回可用', () => {
  it('事件结束后 40ms（超时窗口已过），后续事件、_set 与 v-model 写回正常（真实节奏）', { retry: 2 }, async () => {
    const mounted = mount(
      {
        type: 'div',
        children: [
          { type: 'VarioInput', model: 'text' },
          { type: 'button', events: { click: [{ type: 'set', path: 'count', value: '{{ count + 1 }}' }] } },
          { type: 'span', children: '{{ count }}' }
        ]
      },
      {
        state: { count: 0, text: '' }
      }
    )
    await nextTick()
    const ctx = mounted.api().ctx.value

    // 第一次事件
    mounted.host.querySelector('button')!.click()
    await nextTick()
    expect(mounted.host.textContent).toContain('1')
    // 等待超过默认事件超时窗口的间隙（真实节奏）
    await new Promise(resolve => setTimeout(resolve, 40))

    // 会话窗口已过：后续事件正常
    mounted.host.querySelector('button')!.click()
    await nextTick()
    expect(mounted.host.textContent).toContain('2')

    // _set 正常
    ctx._set('count', 100)
    await nextTick()
    expect(mounted.host.textContent).toContain('100')

    // v-model 写回正常（组件 model 路径）
    const input = mounted.host.querySelector('input') as HTMLInputElement
    input.value = 'hello'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(ctx._get('text')).toBe('hello')
    mounted.unmount()
  })
})

describe('事件 scope frame 按 id 释放', () => {
  it('两个交叠异步事件完成后 frames.size 归零', async () => {
    let resolveFirst: (() => void) | null = null
    const mounted = mount(
      {
        type: 'div',
        children: [
          { type: 'button', events: { click: 'slowA' } },
          { type: 'button', events: { click: 'fastB' } }
        ]
      },
      {
        state: {},
        methods: {
          slowA: () => new Promise<void>(resolve => { resolveFirst = resolve }),
          fastB: () => {}
        }
      }
    )
    await nextTick()
    const session = getPageSessionForContext(mounted.api().ctx.value)
    expect(session).toBeDefined()
    const before = session!.frames.size

    const buttons = mounted.host.querySelectorAll('button')
    buttons[0].click() // 慢事件（挂起）
    await new Promise(resolve => setTimeout(resolve, 5))
    buttons[1].click() // 快事件（交叠）
    await new Promise(resolve => setTimeout(resolve, 5))

    resolveFirst?.()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(session!.frames.size).toBe(before)
    mounted.unmount()
  })
})
