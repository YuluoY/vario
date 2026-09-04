import { describe, expect, it } from 'vitest'
import { DynamicRegion } from '../../src/components/dynamic-region.js'

describe('T2.4 DynamicRegion', () => {
  it('only takes sessionId and regionId', () => {
    expect(Object.keys((DynamicRegion as { props: object }).props).sort()).toEqual(['regionId', 'sessionId'])
  })
})
