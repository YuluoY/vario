import { describe, expect, it } from 'vitest'
import { VarioRoot } from '../../src/components/vario-root.js'
import { DynamicRegion, StaticRegion } from '../../src/components/dynamic-region.js'
import { LoopRegion } from '../../src/components/loop-region.js'
import { LoopItemCell } from '../../src/components/loop-item-cell.js'
import { SlotRegion } from '../../src/components/slot-region.js'

describe('T2.3 VarioRoot', () => {
  it('only accepts sessionId and rootId', () => {
    expect(Object.keys((VarioRoot as { props: object }).props).sort()).toEqual(['rootId', 'sessionId'])
  })
})

describe('T2.4/T2.5/T3.4/T3.7 region components', () => {
  it('region components take only session/region ids', () => {
    for (const cmp of [DynamicRegion, StaticRegion, LoopRegion, SlotRegion]) {
      expect(Object.keys((cmp as { props: object }).props).sort()).toEqual(['regionId', 'sessionId'])
    }
  })
})

describe('T3.5 LoopItemCell', () => {
  it('props are stable ids only', () => {
    expect(Object.keys((LoopItemCell as { props: object }).props).sort()).toEqual([
      'generation', 'itemIndex', 'itemKey', 'regionId', 'sessionId'
    ])
  })
})
