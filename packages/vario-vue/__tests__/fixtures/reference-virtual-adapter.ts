import { createReferenceVirtualAdapter, type VirtualListAdapter, type VirtualRange } from '../../src/runtime/virtual-list-adapter.js'

export function createTestVirtualAdapter(viewport = 200, overscan = 0): VirtualListAdapter {
  const adapter = createReferenceVirtualAdapter({ viewport, overscan })
  return {
    getVisibleRange: input => adapter.getVisibleRange(input),
    onItemsChanged() {},
    restoreAnchor() {}
  }
}

export type { VirtualRange }
