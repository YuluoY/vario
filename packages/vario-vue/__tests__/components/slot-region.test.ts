import { describe, expect, it } from 'vitest'
import { SlotRegion } from '../../src/components/slot-region.js'

describe('T3.7 SlotRegion', () => {
  it('SlotRegion component identity is module-stable', async () => {
    const again = (await import('../../src/components/slot-region.js')).SlotRegion
    expect(again).toBe(SlotRegion)
    expect(Object.keys((SlotRegion as { props: object }).props).sort()).toEqual(['regionId', 'sessionId'])
  })

  it('renders fallbackIds through renderNode and does not swallow RangeError', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(fileURLToPath(new URL('../../src/components/slot-region.ts', import.meta.url)), 'utf8')
    expect(src).toContain('plan.fallbackIds')
    expect(src).toContain('session.pushScope(bindings)')
    expect(src).toContain('if (error instanceof RangeError) throw error')
    expect(src).not.toContain('{ ...node.schema }')
  })
})
