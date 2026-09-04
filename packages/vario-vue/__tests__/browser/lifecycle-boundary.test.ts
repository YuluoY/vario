import { describe, expect, it } from 'vitest'
import { VarioLifecycleBoundary } from '../../src/components/lifecycle-boundary.js'

describe('browser lifecycle-boundary', () => {
  it('boundary type is a stable module-level component', () => {
    expect(VarioLifecycleBoundary).toBeTruthy()
  })
})
