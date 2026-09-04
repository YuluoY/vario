import { describe, expect, it } from 'vitest'
import { LoopItemCell } from '../../src/components/loop-item-cell.js'

describe('T3.5 prepared LoopItemCell', () => {
  it('props are only stable ids/key/generation', () => {
    expect(Object.keys((LoopItemCell as { props: object }).props).sort()).toEqual([
      'generation', 'itemIndex', 'itemKey', 'regionId', 'sessionId'
    ])
  })

  it('render uses prepared LoopPlan.template instead of cloning schema', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(fileURLToPath(new URL('../../src/components/loop-item-cell.ts', import.meta.url)), 'utf8')
    expect(src).toContain('plan.template')
    expect(src).not.toContain('{ ...node.schema }')
  })
})
