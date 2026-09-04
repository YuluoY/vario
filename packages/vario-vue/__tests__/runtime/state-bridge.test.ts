import { describe, expect, it } from 'vitest'
import { prepareView } from '@variojs/schema'
import { VueStateBridge } from '../../src/runtime/state-bridge.js'

describe('T2.2 VueStateBridge', () => {
  it('bumps only the matching item token for a loop path', () => {
    const view = prepareView({
      type: 'div',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
      children: [{ type: 'span', children: '{{ item.label }}' }]
    } as never)
    const bridge = new VueStateBridge(view)
    const loopId = [...view.loops.keys()][0]
    const token0 = bridge.tokenFor(`${loopId}:0`)
    const token1 = bridge.tokenFor(`${loopId}:1`)
    const before0 = token0.value
    const before1 = token1.value
    bridge.apply({
      id: 1,
      paths: Object.freeze(['items.0.label']),
      records: Object.freeze([{ path: 'items.0.label', value: 'x' }])
    })
    expect(token0.value).toBe(before0 + 1)
    expect(token1.value).toBe(before1)
  })
})
