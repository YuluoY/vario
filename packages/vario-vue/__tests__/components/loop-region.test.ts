import { describe, expect, it } from 'vitest'
import { LoopRegion, resolveLoopItemKey, assertUniqueLoopKeys } from '../../src/components/loop-region.js'
import { ErrorCodes, VarioError } from '@variojs/core'

describe('T3.4 LoopRegion', () => {
  it('only takes session/region ids and rejects object keys', () => {
    expect(Object.keys((LoopRegion as { props: object }).props).sort()).toEqual(['regionId', 'sessionId'])
    expect(() => resolveLoopItemKey({ id: { x: 1 } }, 0, 'id', 'item', 'root')).toThrow(/null\/object/)
    expect(resolveLoopItemKey({ id: 'a' }, 0, 'id', 'item', 'root')).toBe('a')
    expect(resolveLoopItemKey({}, 3, null, 'item', 'root')).toBe('item:3')
  })

  it('duplicate keys are a typed LOOP_DUPLICATE_KEY error', () => {
    const events: Array<{ name: string; diagnostic?: { code: string } }> = []
    expect(() => assertUniqueLoopKeys(['a', 'a'], 'root', 'n1')).toThrow(VarioError)
    try {
      assertUniqueLoopKeys(['a', 'a'], 'root', 'n1', { emit(event) { events.push(event) } })
    } catch (error) {
      expect(error).toBeInstanceOf(VarioError)
      expect((error as VarioError).code).toBe(ErrorCodes.LOOP_DUPLICATE_KEY)
    }
    expect(events[0]?.name).toBe('loop-duplicate-key')
    expect(events[0]?.diagnostic?.code).toBe(ErrorCodes.LOOP_DUPLICATE_KEY)
    expect(() => assertUniqueLoopKeys(['a', 'b'], 'root', 'n1')).not.toThrow()
  })

  it('null/object keys are LOOP_INVALID_KEY and index fallback is warned', () => {
    try {
      resolveLoopItemKey({ id: { x: 1 } }, 0, 'id', 'item', 'root')
    } catch (error) {
      expect(error).toBeInstanceOf(VarioError)
      expect((error as VarioError).code).toBe(ErrorCodes.LOOP_INVALID_KEY)
    }
    expect(resolveLoopItemKey('plain', 3, null, 'item', 'root')).toBe('item:3')
  })

  it('emits keyed LoopItemCell instead of cloning schema per item', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(fileURLToPath(new URL('../../src/components/loop-region.ts', import.meta.url)), 'utf8')
    expect(src).toContain('h(LoopItemCell')
    expect(src).not.toContain('vnode.memo')
    expect(src).not.toContain('function renderLoopItem')
    expect(src).not.toContain('{ ...node.schema }')
  })
})
