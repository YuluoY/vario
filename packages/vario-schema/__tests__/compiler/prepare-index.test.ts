import { describe, expect, it } from 'vitest'
import { buildPrepareIndex } from '../../src/compiler/prepare-index.js'
import type { SchemaNode } from '../../src/schema.types.js'

describe('T1.3 prepare-index', () => {
  it('index writes are ≤ 3N', () => {
    const schema: SchemaNode = {
      type: 'div',
      children: [
        { type: 'span', children: 'a' },
        { type: 'span', children: 'b' },
        { type: 'span', children: 'c' }
      ]
    }
    const index = buildPrepareIndex(schema)
    expect(index.nodeCount).toBe(4)
    expect(index.writes).toBeLessThanOrEqual(3 * index.nodeCount)
  })

  it('blocks duplicate explicit ids', () => {
    expect(() => buildPrepareIndex({
      type: 'div',
      id: 'dup',
      children: [{ type: 'span', id: 'dup' }]
    } as SchemaNode)).toThrow(/Duplicate/)
  })

  it('root path is empty and children keep order', () => {
    const schema: SchemaNode = {
      type: 'div',
      children: [
        { type: 'span', id: 'a' },
        { type: 'span', id: 'b' }
      ]
    }
    const index = buildPrepareIndex(schema)
    expect(index.nodes[0].path).toBe('')
    expect(index.nodes.map(n => n.id)).toContain('a')
    expect(index.childIdBuf.get(schema)).toEqual(['a', 'b'])
  })
})
