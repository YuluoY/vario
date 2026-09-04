import { describe, expect, it } from 'vitest'
import { StaticRegion } from '../../src/components/static-region.js'

describe('T2.5 StaticRegion', () => {
  it('only takes sessionId and regionId', () => {
    expect(Object.keys((StaticRegion as { props: object }).props).sort()).toEqual(['regionId', 'sessionId'])
  })
})
