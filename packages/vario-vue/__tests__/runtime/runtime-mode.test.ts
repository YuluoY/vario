import { describe, expect, it } from 'vitest'
import { getRuntimeMode, setRuntimeMode } from '../../src/runtime/runtime-mode.js'
import { adaptLegacySchema, isLegacyDocument } from '../../src/runtime/legacy-prepared-adapter.js'

describe('T5.1 runtime mode', () => {
  it('defaults to legacy and switches without changing useVario signature', () => {
    expect(getRuntimeMode()).toBe('legacy')
    setRuntimeMode('prepared')
    expect(getRuntimeMode()).toBe('prepared')
    setRuntimeMode('shadow')
    expect(getRuntimeMode()).toBe('shadow')
    setRuntimeMode('legacy')
    expect(getRuntimeMode()).toBe('legacy')
  })
})

describe('T1.8/COMP-4 legacy adapter', () => {
  it('wraps a bare SchemaNode without requiring SchemaDocument', () => {
    const schema = { type: 'div', children: 'x' }
    expect(isLegacyDocument(schema as never)).toBe(true)
    expect(isLegacyDocument({ version: 1, root: schema } as never)).toBe(false)
    const view = adaptLegacySchema(schema as never)
    expect(view.rootNodeId).toBeTruthy()
    expect(Object.isFrozen(view)).toBe(true)
  })
})
