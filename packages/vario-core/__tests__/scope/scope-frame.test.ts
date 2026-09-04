import { describe, expect, it } from 'vitest'
import { createScopeFrame, lookupBinding, releaseScopeFrame, type ScopeTable } from '../../src/scope/scope-frame.js'

describe('T3.1 ScopeFrame', () => {
  it('does not Object.create a parent context', () => {
    const parent = createScopeFrame(null, { count: 1 })
    const child = createScopeFrame(parent, { item: 'x' })
    expect(Object.getPrototypeOf(child.bindings)).toBe(Object.prototype)
    expect(child.parentId).toBe(parent.id)
  })

  it('looks up local then parent', () => {
    const table: ScopeTable = new Map()
    const parent = createScopeFrame(null, { count: 1, item: 'parent' })
    const child = createScopeFrame(parent, { item: 'child' })
    table.set(parent.id, parent)
    table.set(child.id, child)
    expect(lookupBinding(table, child, 'item').value).toBe('child')
    expect(lookupBinding(table, child, 'count').value).toBe(1)
    releaseScopeFrame(table, child)
    expect(table.has(child.id)).toBe(false)
    expect(table.has(parent.id)).toBe(true)
  })
})
