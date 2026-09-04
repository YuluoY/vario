import { describe, expect, it } from 'vitest'
import { prepareView } from '@variojs/schema'
import { VueStateBridge } from '../../src/runtime/state-bridge.js'

describe('T2.9 region routing', () => {
  it('unrelated state path does not bump a static region token', () => {
    const view = prepareView({
      type: 'div',
      children: [
        { type: 'span', children: '{{ a }}' },
        { type: 'span', children: 'static' }
      ]
    } as never)
    const bridge = new VueStateBridge(view)
    const staticNodes = [...view.nodes.values()].filter(n => n.region === 'static')
    const token = bridge.tokenFor(staticNodes[0]?.id ?? 'none')
    const before = token.value
    bridge.apply({
      id: 1,
      paths: Object.freeze(['unrelated']),
      records: Object.freeze([{ path: 'unrelated', value: 1 }])
    })
    expect(token.value).toBe(before)
  })

  it('PERF-A2/A3 item path only bumps that cell; unrelated path bumps none', () => {
    const view = prepareView({
      type: 'div',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
      children: [{ type: 'span', children: '{{ item }}' }]
    } as never)
    const bridge = new VueStateBridge(view)
    const loopId = [...view.loops.keys()][0]
    const cell0 = bridge.tokenFor(`${loopId}:0`)
    const cell1 = bridge.tokenFor(`${loopId}:1`)
    const loopToken = bridge.tokenFor(loopId)
    const before0 = cell0.value
    const before1 = cell1.value
    const beforeLoop = loopToken.value
    bridge.apply({
      id: 1,
      paths: Object.freeze(['items.1']),
      records: Object.freeze([{ path: 'items.1', value: 'x' }])
    })
    expect(cell1.value).toBe(before1 + 1)
    expect(cell0.value).toBe(before0)
    expect(loopToken.value).toBe(beforeLoop)
    const items = [{ id: 'a' }, { id: 'b' }]
    bridge.apply({
      id: 1,
      paths: Object.freeze(['items.1']),
      records: Object.freeze([{ path: 'items.1', value: 'x' }])
    }, { _get: (path: string) => path === 'items' ? items : undefined } as never)
    expect(bridge.tokenFor(`${loopId}:k:b`).value).toBeGreaterThan(0)
    bridge.apply({
      id: 2,
      paths: Object.freeze(['unrelated']),
      records: Object.freeze([{ path: 'unrelated', value: 1 }])
    })
    expect(cell0.value).toBe(before0)
    expect(cell1.value).toBe(before1 + 1)
  })

  it('item field path does not bump the LoopRegion token', () => {
    const view = prepareView({
      type: 'div',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
      children: [{ type: 'span', children: '{{ item.n }}' }]
    } as never)
    const bridge = new VueStateBridge(view)
    const loopId = [...view.loops.keys()][0]
    const cell1 = bridge.tokenFor(`${loopId}:1`)
    const loopToken = bridge.tokenFor(loopId)
    const beforeCell = cell1.value
    const beforeLoop = loopToken.value
    bridge.apply({
      id: 1,
      paths: Object.freeze(['items.1.n']),
      records: Object.freeze([{ path: 'items.1.n', value: 9 }])
    })
    expect(cell1.value).toBe(beforeCell + 1)
    expect(loopToken.value).toBe(beforeLoop)
  })

  it('PERF-T4 1000 dynamic nodes: values.0 only bumps that leaf token', () => {
    const view = prepareView({
      type: 'div',
      children: Array.from({ length: 1000 }, (_, i) => ({
        type: 'span',
        children: `{{ values[${i}] }}`
      }))
    } as never)
    const bridge = new VueStateBridge(view)
    const dynamic = [...view.nodes.values()].filter(n => n.region === 'dynamic')
    expect(dynamic.length).toBe(1000)
    const tokens = dynamic.map(n => bridge.tokenFor(n.id))
    const before = tokens.map(t => t.value)
    bridge.apply({
      id: 1,
      paths: Object.freeze(['values.0']),
      records: Object.freeze([{ path: 'values.0', value: 'leaf' }])
    })
    expect(tokens.filter((t, i) => t.value !== before[i])).toHaveLength(1)
  })

  it('emits DIRTY_REGION_BUDGET when dirty regions exceed the tick cap', () => {
    const view = prepareView({
      type: 'div',
      children: [
        { type: 'span', children: '{{ a }}' },
        { type: 'span', children: '{{ b }}' }
      ]
    } as never)
    const bridge = new VueStateBridge(view, { maxDirtyRegionsPerTick: 0 })
    bridge.apply({
      id: 1,
      paths: Object.freeze(['a', 'b']),
      records: Object.freeze([{ path: 'a', value: 1 }, { path: 'b', value: 2 }])
    })
    expect(bridge.diagnostics.some(d => d.code === 'DIRTY_REGION_BUDGET')).toBe(true)
  })
})
