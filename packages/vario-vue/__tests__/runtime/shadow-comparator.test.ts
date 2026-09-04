import { describe, expect, it } from 'vitest'
import { compareShadowPlans } from '../../src/runtime/shadow-comparator.js'
import { prepareView } from '@variojs/schema'

describe('T5.2 shadow comparator', () => {
  it('diffs nodeId/path/field and ignores vnode identity', () => {
    const schema = { type: 'div', children: [{ type: 'span', children: 'x' }] } as never
    expect(compareShadowPlans(schema, prepareView(schema))).toEqual([])
    const other = prepareView({ type: 'span', children: 'y' } as never)
    const diffs = compareShadowPlans(schema, other)
    expect(diffs.some(d => d.field === 'nodeCount' || d.field === 'type' || d.field === 'missing')).toBe(true)
    expect(diffs.every(d => 'nodeId' in d && 'path' in d && 'field' in d)).toBe(true)
  })
})
