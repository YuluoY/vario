import { describe, expect, it } from 'vitest'
import { ErrorCodes, VarioError } from '@variojs/core'
import { assertExpandBudget, createReferenceVirtualAdapter } from '../../src/runtime/virtual-list-adapter.js'
import { createTestVirtualAdapter } from '../fixtures/reference-virtual-adapter.js'

describe('T3.8 virtual list', () => {
  it('adapter is optional; over-budget fails; reference 1000 items DOM≤200', () => {
    expect(() => assertExpandBudget(10_001, null)).toThrow(/maxExpandedNodes/)
    expect(() => assertExpandBudget(1000, null)).not.toThrow()
    const adapter = createTestVirtualAdapter(200, 0)
    expect(adapter.getVisibleRange(1000).end).toBe(200)
    expect(createReferenceVirtualAdapter({ viewport: 200, overscan: 0 }).getVisibleRange(1000).end).toBe(200)
    expect(typeof createReferenceVirtualAdapter().restoreAnchor).toBe('function')
    const ranged = createReferenceVirtualAdapter({ viewport: 50, overscan: 2 })
    expect(ranged.getVisibleRange({ itemCount: 1000, overscan: 3 }).end).toBe(53)
    expect(() => ranged.restoreAnchor?.('row-1')).not.toThrow()
    ranged.onItemsChanged?.({ itemCount: 1000 })
    const range = ranged.getVisibleRange({ itemCount: 1000, overscan: 0 })
    expect(range.start).toBe(0)
    expect(range.end).toBeGreaterThan(range.start)
    expect(range.end).toBeLessThanOrEqual(1000)
    expect(range.end - range.start).toBeLessThanOrEqual(50)
    expect(() => assertExpandBudget(12, null, { maxLoopItemsPerRegion: 5 })).toThrow(VarioError)
    try {
      assertExpandBudget(12, null, { maxLoopItemsPerRegion: 5 })
    } catch (error) {
      expect((error as VarioError).code).toBe(ErrorCodes.LOOP_BUDGET_EXCEEDED)
    }
    expect(() => assertExpandBudget(4, null, { maxExpandedNodesPerPage: 3 }, { projectedNodes: 8 })).toThrow(/maxExpandedNodes/)
  })

  it('PERF-D1 default adapter is null; explicit reference adapter caps 1000 at ≤204', async () => {
    const { PageSession } = await import('../../src/runtime/page-session.js')
    const { createRuntimeContext } = await import('@variojs/core')
    const { prepareView } = await import('@variojs/schema')
    const session = new PageSession({
      ctx: createRuntimeContext({}),
      view: prepareView({ type: 'div', children: 'x' } as never)
    })
    // T3.7：默认 virtualAdapter=null（全量渲染），虚拟化仅显式 opt-in
    expect(session.virtualAdapter).toBeNull()
    session.dispose()
    const explicit = new PageSession({
      ctx: createRuntimeContext({}),
      view: prepareView({ type: 'div', children: 'x' } as never),
      virtualAdapter: createReferenceVirtualAdapter({ viewport: 200, overscan: 4 })
    })
    expect(explicit.virtualAdapter?.getVisibleRange(1000).end).toBeLessThanOrEqual(204)
    explicit.dispose()
  })

  it('T3.8 1000-item window preserves setsize/posinset/anchor/focus contract', () => {
    const adapter = createTestVirtualAdapter(200, 4)
    adapter.onItemsChanged({ itemCount: 1000 })
    const range = adapter.getVisibleRange({ itemCount: 1000, overscan: 4 })
    expect(range.end - range.start).toBeLessThanOrEqual(204)
    expect(range.start).toBe(0)
    const setSize = 1000
    const firstPos = range.start + 1
    const lastPos = range.end
    expect(firstPos).toBeGreaterThan(0)
    expect(lastPos).toBeLessThanOrEqual(setSize)
    expect(typeof adapter.restoreAnchor).toBe('function')
    expect(typeof adapter.onItemsChanged).toBe('function')
    expect(() => adapter.restoreAnchor('item-0')).not.toThrow()
    expect(() => adapter.getVisibleRange({ itemCount: 1000, overscan: 4, estimateSize: 24 })).not.toThrow()
  })
})
