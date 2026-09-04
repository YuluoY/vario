import { describe, expect, it } from 'vitest'
import { prepareView } from '../../src/compiler/prepare-view.js'
import { buildPrepareIndex } from '../../src/compiler/prepare-index.js'
import { traverseIterative } from '../../src/compiler/traverse-iterative.js'
import type { SchemaNode } from '../../src/schema.types.js'

function chain(depth: number): SchemaNode {
  let node: SchemaNode = { type: 'span', children: 'leaf' }
  for (let i = 1; i < depth; i++) {
    node = { type: 'div', children: [node] }
  }
  return node
}

describe('T1.9 prepare performance gates', () => {
  it('PERF-A1 index writes ≤ 3N for 1000 nodes', () => {
    const children = Array.from({ length: 999 }, (_, i) => ({ type: 'span', children: `${i}` }))
    const schema: SchemaNode = { type: 'div', children }
    const index = buildPrepareIndex(schema)
    expect(index.nodeCount).toBe(1000)
    expect(index.writes).toBeLessThanOrEqual(3 * index.nodeCount)
  })

  it('PERF-A6 compiler 10,000 depth does not RangeError', () => {
    const stats = traverseIterative(chain(10_000), () => {})
    expect(stats.maxDepth).toBe(10_000)
    expect(() => prepareView(chain(10_000), { maxDepth: 10_000 })).not.toThrow(RangeError)
  })

  it('PERF-T1 prepare 1000 nodes / 500 expressions p95 ≤20ms', () => {
    const children = Array.from({ length: 500 }, (_, i) => ({
      type: 'span',
      children: `{{ v${i % 500} }}`
    }))
    const schema: SchemaNode = {
      type: 'div',
      children: [
        ...children,
        ...Array.from({ length: 499 }, (_, i) => ({ type: 'span', children: `s-${i}` }))
      ]
    }
    // 按固定 runner 协议先预热（填充 plan cache），再采样
    for (let i = 0; i < 2; i++) prepareView(schema)
    const samples: number[] = []
    for (let i = 0; i < 8; i++) {
      const t0 = performance.now()
      const view = prepareView(schema)
      samples.push(performance.now() - t0)
      expect(view.nodeCount).toBe(1000)
    }
    samples.sort((a, b) => a - b)
    const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))]
    expect(p95).toBeLessThanOrEqual(20)
  })
})
