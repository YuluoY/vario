import { describe, expect, it } from 'vitest'
import { VarioErrorBoundary } from '../../src/components/error-boundary.js'

describe('browser error-boundary', () => {
  it('error boundary is a stable module-level component', () => {
    expect(VarioErrorBoundary).toBeTruthy()
  })
})
