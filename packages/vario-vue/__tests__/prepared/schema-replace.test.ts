/**
 * @vitest-environment happy-dom
 */
/**
 * 回归测试：prepared schema 根替换重建 view（AC-8 / T3.6）
 */

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, nextTick, ref } from 'vue'
import { useVario, getRuntimeMode, setRuntimeMode } from '../../src/index.js'

describe('AC-8 prepared schema 根替换', () => {
  it('computed schema 替换后渲染新 view', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const variant = ref<'a' | 'b'>('a')
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api!: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(
          () => (variant.value === 'a'
            ? { type: 'div', children: [{ type: 'span', children: 'view-a' }] }
            : { type: 'section', children: [{ type: 'p', children: 'view-b' }] }),
          { state: {} as never }
        )
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(host.querySelector('span')?.textContent).toBe('view-a')
    expect(host.querySelector('section')).toBeNull()

    variant.value = 'b'
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(host.querySelector('section')).not.toBeNull()
    expect(host.querySelector('p')?.textContent).toBe('view-b')
    expect(host.querySelector('span')).toBeNull()
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })
})
