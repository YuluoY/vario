import { describe, expect, it } from 'vitest'
import { applyRegionClassification, classifyRegion, groupMaximalRegions } from '../../src/compiler/prepare-node.js'
import { buildPrepareIndex } from '../../src/compiler/prepare-index.js'
import type { SchemaNode } from '../../src/schema.types.js'

describe('T1.4 region classification', () => {
  it('static chain becomes a maximal static region', () => {
    const schema: SchemaNode = {
      type: 'div',
      children: [{ type: 'span', children: 'static' }]
    }
    const index = buildPrepareIndex(schema)
    const nodes = applyRegionClassification(index.nodes, index.sourceById)
    const regions = groupMaximalRegions(nodes)
    expect(classifyRegion(schema)).toBe('static')
    expect(regions.find(r => r.kind === 'static')?.nodeIds.length).toBeGreaterThan(0)
  })

  it('loop/lifecycle/dynamic are boundaries', () => {
    expect(classifyRegion({ type: 'div', loop: { items: 'items' } })).toBe('loop')
    expect(classifyRegion({ type: 'div', onMounted: 'boot' } as SchemaNode)).toBe('semantic')
    expect(classifyRegion({ type: 'div', onActivated: 'resume' } as SchemaNode)).toBe('semantic')
    expect(classifyRegion({ type: 'div', onDeactivated: 'pause' } as SchemaNode)).toBe('semantic')
    expect(classifyRegion({ type: 'span', children: '{{ label }}' })).toBe('dynamic')
    expect(classifyRegion({ type: 'template', slot: 'default' })).toBe('slot')
    expect(classifyRegion({ type: 'div', transition: 'fade', children: 'tr' } as SchemaNode)).toBe('semantic')
    expect(classifyRegion({ type: 'div', keepAlive: true, children: 'ka' } as SchemaNode)).toBe('semantic')
    expect(classifyRegion({ type: 'div', teleport: '#host', children: 'x' } as SchemaNode)).toBe('semantic')
    expect(classifyRegion({
      type: 'Panel',
      children: [
        { type: 'template', slot: 'header', children: [{ type: 'span', children: 'H' }] },
        { type: 'span', children: 'body' }
      ]
    })).toBe('semantic')
  })
})
