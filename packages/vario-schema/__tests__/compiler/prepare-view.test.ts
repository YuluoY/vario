import { describe, expect, it } from 'vitest'
import { prepareView, getPreparedSources } from '../../src/compiler/prepare-view.js'
import type { SchemaNode } from '../../src/schema.types.js'

describe('T1.7 prepareView', () => {
  it('compiles expressions, loops and regions without mutating schema', () => {
    const schema: SchemaNode = {
      type: 'div',
      children: [
        { type: 'span', children: '{{ title }}' },
        {
          type: 'ul',
          loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
          children: [{ type: 'li', children: '{{ item }}' }]
        }
      ]
    }
    const frozen = JSON.parse(JSON.stringify(schema))
    const view = prepareView(schema)
    expect(view.nodeCount).toBeGreaterThan(1)
    expect(view.expressions.size).toBeGreaterThan(0)
    expect(view.loops.size).toBe(1)
    expect(schema).toEqual(frozen)
    expect(Object.isFrozen(view)).toBe(true)
    expect(view.nodes).toBeInstanceOf(Map)
    expect(view.regions).toBeInstanceOf(Map)
    expect(view.nodeList![0].schema).toBeUndefined()
    expect(view.rootNodeId).toBe(view.nodeList![0].id)
    expect(view.rootId).toBe(view.rootNodeId)
    expect(view.stats?.nodeCount).toBe(view.nodeCount)
    expect(view.nodeList![0].flags).toEqual(expect.any(Number))
  })

  it('does not compile mixed interpolations as a single expression plan', () => {
    const view = prepareView({
      type: 'span',
      children: '{{ item.label }}-{{ cell.n }}-{{ index }}'
    } as SchemaNode)
    expect(view.nodeList!.some(n => n.textPlan)).toBe(false)
    expect([...view.expressions.values()].some(p => p.source === 'item.label')).toBe(true)
    expect([...view.expressions.values()].some(p => p.source === 'cell.n')).toBe(true)
  })

  it('compiles event actions into the prepared view', () => {
    const view = prepareView({
      type: 'button',
      events: { click: 'save' },
      children: '{{ n }}'
    } as SchemaNode)
    expect(view.expressions.size).toBeGreaterThan(0)
    expect(view.actions.size).toBe(1)
  })

  it('reuses the frozen plan for the same root and explicit revision', () => {
    const schema: SchemaNode = { type: 'div', children: 'x' }
    const first = prepareView(schema, { revision: 4 })
    const second = prepareView(schema, { revision: 4 })
    expect(second).toBe(first)
    expect(prepareView(schema, { revision: 5 })).not.toBe(first)
  })

  it('unknown PascalCase material warns in legacy and blocks in strict mode', () => {
    const schema: SchemaNode = { type: 'WidgetX', children: 'x' }
    const warned = prepareView(schema, { materials: new Map() })
    expect(warned.diagnostics.some(d => d.code === 'UNKNOWN_MATERIAL')).toBe(true)
    const names: string[] = []
    prepareView(schema, {
      materials: new Map(),
      diagnosticSink: { emit(event) { names.push(event.name) } }
    })
    expect(names).toContain('material-error')
    const resolved: string[] = []
    prepareView(schema, {
      materials: new Map([['WidgetX', { name: 'WidgetX', version: '1.0.0' }]]),
      diagnosticSink: { emit(event) { resolved.push(event.name) } }
    })
    expect(resolved).toContain('material-resolve')
    expect(() => prepareView(schema, { materials: new Map(), materialMode: 'strict' })).toThrow(/Unknown material/)
  })

    it('does not publish a partial view on duplicate id', () => {
      expect(() => prepareView({
        type: 'div',
        id: 'x',
        children: [{ type: 'span', id: 'x' }]
      } as SchemaNode)).toThrow()
    })

    it('emits LOOP_INDEX_KEY_FALLBACK when loop has no key', () => {
      const view = prepareView({
        type: 'ul',
        loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
        children: [{ type: 'li', children: '{{ item }}' }]
      } as SchemaNode)
      expect(view.diagnostics.some(d => d.code === 'LOOP_INDEX_KEY_FALLBACK')).toBe(true)
    })

    it('marks the page legacyRequired when loop items is a function', () => {
      const view = prepareView({
        type: 'ul',
        loop: { items: () => [], itemKey: 'item' } as never,
        children: [{ type: 'li', children: '{{ item }}' }]
      } as SchemaNode)
      expect(view.legacyRequired).toBe(true)
      expect(view.diagnostics.some(d => d.code === 'LEGACY_REQUIRED')).toBe(true)
      expect([...view.loops.values()][0]?.itemsPlanId).toBeUndefined()
    })

    it('marks the page legacyRequired when loop key is an object', () => {
      const view = prepareView({
        type: 'ul',
        loop: { items: 'items', itemKey: 'item', key: { x: 1 } as never },
        children: [{ type: 'li', children: '{{ item }}' }]
      } as SchemaNode)
      expect(view.legacyRequired).toBe(true)
      expect(view.diagnostics.some(d => d.code === 'LEGACY_REQUIRED')).toBe(true)
    })

    it('marks the page legacyRequired when slot or event is a function', () => {
      expect(prepareView({
        type: 'Panel',
        slot: (() => 'header') as never,
        children: 'x'
      } as SchemaNode).legacyRequired).toBe(true)
      expect(prepareView({
        type: 'button',
        events: { click: (() => {}) as never },
        children: 'go'
      } as SchemaNode).diagnostics.some(d => d.code === 'LEGACY_REQUIRED')).toBe(true)
    })

    it('emits LOOP_LARGE_LIST for static arrays of 100+ items', () => {
      const view = prepareView({
        type: 'ul',
        loop: { items: Array.from({ length: 100 }, (_, i) => i), itemKey: 'item', key: 'id' },
        children: [{ type: 'li', children: '{{ item }}' }]
      } as SchemaNode)
      expect(view.diagnostics.some(d => d.code === 'LOOP_LARGE_LIST' && d.metadata?.count === 100)).toBe(true)
      expect(prepareView({
        type: 'ul',
        loop: { items: Array.from({ length: 99 }, (_, i) => i), itemKey: 'item', key: 'id' },
        children: [{ type: 'li', children: '{{ item }}' }]
      } as SchemaNode).diagnostics.some(d => d.code === 'LOOP_LARGE_LIST')).toBe(false)
    })

    it('does not freeze a live schema reference onto PreparedNode', () => {
      const schema: SchemaNode = { type: 'div', props: { id: 'ok', label: '{{ title }}' }, children: 'x' }
      const view = prepareView(schema)
      expect(view.nodeList![0].schema).toBeUndefined()
      expect(getPreparedSources(view)?.get(view.nodeList![0].id)).toBe(schema)
      expect(view.nodeList![0].staticAttrs).toEqual({ id: 'ok' })
      expect(view.nodeList![0].staticProps).toEqual(view.nodeList![0].staticAttrs)
      expect(view.nodeList![0].featureFlags).toBe(view.nodeList![0].flags)
      expect(view.nodeList![0].childrenIds).toEqual(view.nodeList![0].childIds)
      expect(view.nodeList![0].regionId).toBe(view.nodeList![0].id)
      expect(view.nodeList![0].dynamicProps?.label).toBeTruthy()
      expect(view.regionMap?.size).toBe(view.regions.size)
      expect(Object.isFrozen(view.nodeList![0])).toBe(true)
    })
})
