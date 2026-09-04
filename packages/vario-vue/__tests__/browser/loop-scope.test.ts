import { describe, expect, it } from 'vitest'
import { createRuntimeContext } from '@variojs/core'
import { VueRenderer } from '../../src/renderer.js'

describe('browser loop-scope', () => {
  it('renders itemKey/indexKey aliases', () => {
    const ctx = createRuntimeContext({ items: [{ label: 'a' }, { label: 'b' }] })
    const vnode = new VueRenderer().render({
      type: 'div',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
      children: [{ type: 'span', children: '{{ item.label }}-{{ index }}' }]
    }, ctx)
    expect(vnode).toBeTruthy()
    expect(JSON.stringify(vnode)).not.toContain('"children":null')
  })
})
