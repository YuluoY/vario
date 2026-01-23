import { describe, it, expect } from 'vitest'
import { createRuntimeContext } from '@vario/core'
import { defineSchema } from '@vario/schema'

describe('Basic integration between core and schema', () => {
  it('should create runtime context with state', () => {
    const ctx = createRuntimeContext({ count: 0 })
    expect(ctx.count).toBe(0)
    expect(ctx.$emit).toBeDefined()
    expect(ctx.$methods).toBeDefined()
  })

  it('should define a simple schema', () => {
    const view = defineSchema({
      state: { count: 0 },
      schema() {
        return {
          type: 'div',
          children: []
        }
      }
    })

    expect(view.schema).toBeDefined()
    expect(view.schema.type).toBe('div')
    expect(view.stateType).toEqual({ count: 0 })
  })

  it('should create runtime context from schema view', () => {
    const view = defineSchema({
      state: { count: 5 },
      schema() {
        return {
          type: 'div',
          children: []
        }
      }
    })

    const ctx = createRuntimeContext(view.stateType)
    expect(ctx.count).toBe(5)
  })
})