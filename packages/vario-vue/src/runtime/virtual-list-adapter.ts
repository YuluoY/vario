import { VarioError, ErrorCodes } from '@variojs/core'

export type VirtualRange = { start: number; end: number; overscan: number }

export type VirtualRangeInput = {
  itemCount: number
  overscan?: number
  estimateSize?: number
}

export type LoopChangeSet = {
  itemCount: number
}

export type VirtualListAdapter = {
  getVisibleRange(itemCount: number | VirtualRangeInput): VirtualRange
  onItemsChanged?(change: LoopChangeSet): void
  restoreAnchor?(key: string | number): void
}

export const DEFAULT_MAX_EXPANDED_NODES = 1e4
export const REFERENCE_DOM_CAP = 200

export function createReferenceVirtualAdapter(
  options: { viewport?: number; overscan?: number } = {}
): VirtualListAdapter {
  const viewport = options.viewport ?? REFERENCE_DOM_CAP
  const o = options.overscan ?? 4
  const z = () => {}
  return {
    getVisibleRange(input) {
      const n = typeof input === 'number' ? input : input.itemCount
      const overscan = typeof input === 'number' ? o : input.overscan ?? o
      return { start: 0, end: Math.min(n, viewport + overscan), overscan }
    },
    restoreAnchor: z
  }
}

export type RuntimeExpandBudget = {
  maxExpandedNodes?: number
  maxLoopItemsPerRegion?: number
  maxExpandedNodesPerPage?: number
  maxActiveLoopCells?: number
  maxScopeDepth?: number
}

export type ExpandBudgetExtras = {
  projectedNodes?: number
  activeCells?: number
  scopeDepth?: number
}

export function assertExpandBudget(
  itemCount: number,
  adapter: VirtualListAdapter | null,
  maxExpanded: number | RuntimeExpandBudget = DEFAULT_MAX_EXPANDED_NODES,
  extras: ExpandBudgetExtras = {}
): void {
  const b = typeof maxExpanded === 'number' ? { maxExpandedNodes: maxExpanded } : maxExpanded
  const max = b.maxExpandedNodes ?? DEFAULT_MAX_EXPANDED_NODES
  const fail = (k: string, a: number, l: number): never => {
    throw new VarioError(`${a} exceeds ${k}=${l}`, ErrorCodes.LOOP_BUDGET_EXCEEDED, { metadata: { actual: a, limit: l } })
  }
  if (b.maxLoopItemsPerRegion != null && itemCount > b.maxLoopItemsPerRegion) fail('maxLoopItemsPerRegion', itemCount, b.maxLoopItemsPerRegion)
  if (b.maxScopeDepth != null && extras.scopeDepth != null && extras.scopeDepth > b.maxScopeDepth) fail('maxScopeDepth', extras.scopeDepth, b.maxScopeDepth)
  const active = extras.activeCells ?? (adapter ? undefined : itemCount)
  if (b.maxActiveLoopCells != null && active != null && active > b.maxActiveLoopCells) fail('maxActiveLoopCells', active, b.maxActiveLoopCells)
  if (!adapter && (itemCount > max || (extras.projectedNodes ?? itemCount) > (b.maxExpandedNodesPerPage ?? max))) {
    fail('maxExpandedNodes', Math.max(itemCount, extras.projectedNodes ?? itemCount), max)
  }
}
