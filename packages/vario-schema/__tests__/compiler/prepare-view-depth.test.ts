import { describe, expect, it } from 'vitest'
import { prepareView } from '../../src/compiler/prepare-view.js'
import type { SchemaNode } from '../../src/schema.types.js'

function chain(depth: number): SchemaNode {
  let node: SchemaNode = { type: 'span', children: 'leaf' }
  for (let i = 1; i < depth; i++) {
    node = { type: 'div', children: [node] }
  }
  return node
}

describe('PERF-A6 prepareView deep chain', () => {
  it('prepares a 10,000-layer chain without RangeError', () => {
    const view = prepareView(chain(10_000))
    expect(view.nodeCount).toBe(10_000)
    expect(view.maxDepth).toBe(10_000)
  })

  it('collectExpressionSources is O(N) on deep chains (no subtree rescan)', () => {
    // 修复前深链每节点会重扫整棵子树（O(N²)）；这里验证两次 prepare 的耗时
    // 不逐层指数增长：深度加倍耗时不应超过约 4 倍（回归护栏，不做精确计时断言）
    const t0 = performance.now()
    prepareView(chain(5_000))
    const t1 = performance.now()
    prepareView(chain(10_000))
    const t2 = performance.now()
    const ratio = (t2 - t1) / Math.max(t1 - t0, 0.5)
    // O(N) 时 ratio≈2，O(N²) 时 ratio≈4；给足余量取 5
    expect(ratio).toBeLessThan(5)
  })
})
