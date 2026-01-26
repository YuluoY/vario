/**
 * Schema 规范化器测试
 */

import { describe, it, expect } from 'vitest'
import { normalizeSchema } from '../src/normalizer.js'
import type { SchemaNode } from '../src/schema.types.js'

describe('Schema 规范化器', () => {
  it('应该规范化 Schema', () => {
    const schema: SchemaNode = {
      type: 'Button',
      props: {
        label: '提交',
        disabled: undefined // 应该被移除
      }
    }

    const normalized = normalizeSchema(schema)

    expect(normalized.type).toBe('Button')
    expect(normalized.props?.label).toBe('提交')
    expect(normalized.props?.disabled).toBeUndefined()
  })

  it('应该规范化表达式插值格式', () => {
    const schema: SchemaNode = {
      type: 'div',
      children: '{{user.name}}' // 缺少空格
    }

    const normalized = normalizeSchema(schema)

    expect(normalized.children).toBe('{{ user.name }}')
  })

  it('应该规范化循环配置', () => {
    const schema: SchemaNode = {
      type: 'div',
      loop: {
        items: '  items  ', // 多余空格
        itemKey: '  item  '
      }
    }

    const normalized = normalizeSchema(schema)

    expect(normalized.loop?.items).toBe('items')
    expect(normalized.loop?.itemKey).toBe('item')
  })

  it('应该规范化 model 作用域对象', () => {
    const schema: SchemaNode = {
      type: 'form',
      model: { path: '  form  ', scope: true }
    }
    const normalized = normalizeSchema(schema)
    expect(normalized.model).toEqual({ path: 'form', scope: true })
  })

  it('应该移除空事件处理器', () => {
    const schema: SchemaNode = {
      type: 'Button',
      events: {
        click: [] // 空数组应该被移除
      }
    }

    const normalized = normalizeSchema(schema)

    expect(normalized.events).toBeUndefined()
  })
})
