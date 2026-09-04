import { describe, expect, it } from 'vitest'
import { compileLoopPlan } from '../../src/compiler/prepare-loop.js'
import { compileSlotPlan } from '../../src/compiler/prepare-slot.js'

describe('T3.3 LoopPlan and SlotPlan', () => {
  it('freezes compiled plans', () => {
    const loop = compileLoopPlan({
      type: 'div',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' }
    } as never, 'n1', ['c1'])
    const slot = compileSlotPlan({ type: 'template', slot: 'header' } as never, 'n2', [])
    expect(Object.isFrozen(loop)).toBe(true)
    expect(Object.isFrozen(slot)).toBe(true)
    expect(loop?.itemsSource).toBe('items')
    expect(loop?.template.loop).toBeUndefined()
    expect(Object.isFrozen(loop?.template)).toBe(true)
    expect(loop?.regionId).toBe('n1')
    expect(loop?.itemAlias).toBe('item')
    expect(loop?.indexAlias).toBe('index')
    expect(loop?.templateNodeId).toBe('c1')
    expect(loop?.itemsPlanId).toEqual(expect.any(String))
    expect(loop?.estimatedTemplateNodes).toBe(1)
    expect(loop?.virtual).toBeUndefined()
    expect(slot?.name).toBe('header')
  })

  it('keeps virtual:false on the frozen loop plan', () => {
    const loop = compileLoopPlan({
      type: 'div',
      loop: { items: 'items', itemKey: 'item', virtual: false }
    } as never, 'n1', ['c1'])
    expect(loop?.virtual).toBe(false)
  })

  it('strips mustache wrappers from items and key sources', () => {
    const loop = compileLoopPlan({
      type: 'div',
      loop: { items: '{{ items }}', itemKey: 'row', key: '{{ id }}' }
    } as never, 'n1', ['c1'])
    expect(loop?.itemsSource).toBe('items')
    expect(loop?.keySource).toBe('id')
    expect(loop?.itemAlias).toBe('row')
  })
})
