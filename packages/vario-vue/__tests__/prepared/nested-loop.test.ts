/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'
import { useVario, getRuntimeMode, setRuntimeMode } from '../../src/index.js'

describe('T3.6 nested loop', () => {
  it('two-level alias, append and same-name scope stay isolated', async () => {
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const rows = [
      { id: 'r1', label: 'A', inner: [{ id: 'c1', n: 1 }] },
      { id: 'r2', label: 'B', inner: [{ id: 'c2', n: 2 }] }
    ]
    const schema = {
      type: 'div',
      loop: { items: 'rows', itemKey: 'item', indexKey: 'index' },
      children: [{
        type: 'div',
        loop: { items: 'item.inner', itemKey: 'cell', indexKey: 'j' },
        children: [{ type: 'span', children: '{{ item.label }}-{{ cell.n }}-{{ index }}' }]
      }]
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(schema as never, { state: { rows } })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    expect(host.textContent).toContain('A-1-0')
    expect(host.textContent).toContain('B-2-1')
    api!.ctx.value._set('rows.0.inner.0.n', 9)
    await nextTick()
    expect(host.textContent).toContain('A-9-0')
    expect(host.textContent).toContain('B-2-1')
    app.unmount()
    host.remove()
    setRuntimeMode(previous)
  })
})
