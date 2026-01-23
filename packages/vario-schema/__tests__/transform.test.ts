/**
 * defineSchema 转换器测试
 */

import { describe, it, expect } from 'vitest'
import { defineSchema, extractSchema } from '../src/transform.js'
import type { SchemaNode } from '../src/schema.types.js'

describe('defineSchema 转换器', () => {
  it('应该将 defineSchema 转换为纯 Schema', () => {
    const view = defineSchema({
      state: {
        count: 0
      },
      schema() {
        return {
          type: 'div',
          children: [
            {
              type: 'Button',
              props: {
                label: 'Click'
              }
            }
          ]
        }
      }
    })

    expect(view.schema.type).toBe('div')
    expect(Array.isArray(view.schema.children)).toBe(true)
  })

  it('应该支持服务注册', () => {
    const view = defineSchema({
      state: {
        user: { name: '' }
      },
      services: {
        async fetchUser() {
          return { name: 'John' }
        }
      },
      schema({ state }) {
        return {
          type: 'div',
          children: `{{ user.name }}`
        }
      }
    })

    expect(view.servicesType).toBeDefined()
    expect(view.schema.type).toBe('div')
  })

  it('应该验证 Schema', () => {
    expect(() => {
      defineSchema({
        state: {},
        schema() {
          return {
            type: '', // 无效的 type
            props: {}
          } as SchemaNode
        }
      })
    }).toThrow()
  })

  it('应该规范化 Schema', () => {
    const view = defineSchema({
      state: {},
      schema() {
        return {
          type: 'div',
          props: {
            label: 'Test',
            disabled: undefined // 应该被移除
          }
        }
      }
    })

    expect(view.schema.props?.disabled).toBeUndefined()
  })

  it('应该提取纯 Schema', () => {
    const view = defineSchema({
      state: { count: 0 },
      schema() {
        return {
          type: 'div'
        }
      }
    })

    const schema = extractSchema(view)

    expect(schema.type).toBe('div')
    expect(schema).not.toHaveProperty('stateType')
  })
})
