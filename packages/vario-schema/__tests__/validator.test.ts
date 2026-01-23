/**
 * Schema 验证器测试
 */

import { describe, it, expect } from 'vitest'
import { validateSchema, SchemaValidationError } from '../src/validator.js'
import type { SchemaNode } from '../src/schema.types.js'

describe('Schema 验证器', () => {
  it('应该验证有效的 Schema', () => {
    const schema: SchemaNode = {
      type: 'Button',
      props: {
        label: '提交'
      }
    }

    expect(() => validateSchema(schema)).not.toThrow()
  })

  it('应该在缺少 type 时抛出错误', () => {
    const invalidSchema = {
      props: { label: '提交' }
    }

    expect(() => validateSchema(invalidSchema)).toThrow(SchemaValidationError)
  })

  it('应该验证表达式', () => {
    const schema: SchemaNode = {
      type: 'div',
      cond: 'user.age >= 18'
    }

    expect(() => validateSchema(schema)).not.toThrow()
  })

  it('应该验证无效的表达式', () => {
    const schema: SchemaNode = {
      type: 'div',
      cond: 'user.age = 18' // 赋值表达式，应该被拒绝
    }

    expect(() => validateSchema(schema)).toThrow(SchemaValidationError)
  })

  it('应该验证 model 路径', () => {
    const schema: SchemaNode = {
      type: 'Input',
      model: 'user.name'
    }

    expect(() => validateSchema(schema)).not.toThrow()
  })

  it('应该拒绝以 $ 开头的路径', () => {
    const schema: SchemaNode = {
      type: 'Input',
      model: '$emit' // 系统 API，应该被拒绝
    }

    expect(() => validateSchema(schema)).toThrow(SchemaValidationError)
  })

  it('应该验证循环配置', () => {
    const schema: SchemaNode = {
      type: 'div',
      loop: {
        items: 'items',
        itemKey: 'item'
      }
    }

    expect(() => validateSchema(schema)).not.toThrow()
  })

  it('应该在循环配置缺少 items 时抛出错误', () => {
    const schema = {
      type: 'div',
      loop: {
        itemKey: 'item'
      }
    }

    expect(() => validateSchema(schema)).toThrow(SchemaValidationError)
  })
})
