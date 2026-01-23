import { describe, it, expect } from 'vitest'
import { createRuntimeContext, execute } from '@vario/core'
import { defineSchema } from '@vario/schema'

describe('Schema and VM integration', () => {
  it('should create runtime context from schema state', () => {
    const view = defineSchema({
      state: { count: 0, name: 'Test' },
      schema() {
        return {
          type: 'div',
          children: []
        }
      }
    })

    const ctx = createRuntimeContext(view.stateType)
    expect(ctx.count).toBe(0)
    expect(ctx.name).toBe('Test')
    expect(ctx.$emit).toBeDefined()
    expect(ctx.$methods).toBeDefined()
  })

  it('should execute set instruction defined in schema events', async () => {
    // 创建一个包含事件指令的 schema
    const view = defineSchema({
      state: { count: 0 },
      schema() {
        return {
          type: 'div',
          events: {
            click: [
              { op: 'set', path: 'count', value: '{{ count + 1 }}' }
            ]
          }
        }
      }
    })

    // 创建运行时上下文
    const ctx = createRuntimeContext(view.stateType)
    
    // 从 schema 中提取指令并执行
    const instructions = view.schema.events?.click || []
    await execute(instructions, ctx)
    
    expect(ctx.count).toBe(1)
  })

  it('should handle services registration through defineSchema', async () => {
    const mockService = async (params: any) => {
      return { result: params.input * 2 }
    }

    const view = defineSchema({
      state: { value: 0 },
      services: {
        double: mockService
      },
      schema() {
        return {
          type: 'div',
          children: []
        }
      }
    })

    // 注意：defineSchema 目前不自动注册 services 到 $methods，
    // 但返回的 view 包含 servicesType
    expect(view.servicesType).toBeDefined()
    expect(view.servicesType?.double).toBeDefined()
  })

  it('should validate schema with expressions', () => {
    const view = defineSchema({
      state: { items: [1, 2, 3] },
      schema() {
        return {
          type: 'div',
          children: [
            {
              type: 'span',
              cond: '{{ items.length > 0 }}',
              children: 'Has items'
            }
          ]
        }
      }
    })

    expect(view.schema.type).toBe('div')
    expect(view.schema.children).toHaveLength(1)
    const child = view.schema.children[0]
    expect(child.cond).toBe('{{ items.length > 0 }}')
  })
})