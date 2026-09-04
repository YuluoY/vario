import { describe, expect, it } from 'vitest'
import { traverseIterative } from '../../src/compiler/traverse-iterative.js'
import { SchemaDepthError } from '@variojs/core'
import type { SchemaNode } from '../../src/schema.types.js'

function chain(depth: number): SchemaNode {
  let node: SchemaNode = { type: 'span', children: 'leaf' }
  for (let i = 1; i < depth; i++) {
    node = { type: 'div', children: [node] }
  }
  return node
}

describe('T1.2 traverseIterative', () => {
  it('visits 10,000 layers without RangeError', () => {
    const stats = traverseIterative(chain(10_000), () => {})
    expect(stats.nodeCount).toBe(10_000)
    expect(stats.maxDepth).toBe(10_000)
  })

  it('stops before allocating the next node when maxNodes is exceeded', () => {
    expect(() => traverseIterative(chain(5), () => {}, { maxNodes: 3 })).toThrow()
  })

  it('throws SchemaDepthError with node/path/actual/limit', () => {
    try {
      traverseIterative(chain(8), () => {}, { maxDepth: 3 })
      throw new Error('expected SchemaDepthError')
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaDepthError)
      const metadata = (error as SchemaDepthError).context.metadata
      expect(metadata?.node).toBeTruthy()
      expect(metadata?.path).toBeDefined()
      expect(metadata?.actual).toBe(4)
      expect(metadata?.limit).toBe(3)
    }
  })

  it('detects cycles', () => {
    const a: SchemaNode = { type: 'div', children: [] }
    const b: SchemaNode = { type: 'div', children: [a] }
    ;(a.children as SchemaNode[]).push(b)
    expect(() => traverseIterative(a, () => {})).toThrow(/Circular/)
  })
})
