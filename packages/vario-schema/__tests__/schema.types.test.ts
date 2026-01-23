/**
 * Schema 类型测试
 */

import { describe, it, expect } from 'vitest'
import type { SchemaNode, LoopConfig, DefineSchemaConfig } from '../src/schema.types.js'

describe('Schema 类型', () => {
  it('应该定义有效的 SchemaNode', () => {
    const node: SchemaNode = {
      type: 'Button',
      props: {
        label: '提交'
      }
    }

    expect(node.type).toBe('Button')
    expect(node.props?.label).toBe('提交')
  })

  it('应该支持表达式插值', () => {
    const node: SchemaNode = {
      type: 'div',
      children: '{{ user.name }}'
    }

    expect(typeof node.children).toBe('string')
  })

  it('应该支持循环配置', () => {
    const loop: LoopConfig = {
      items: 'items',
      itemKey: 'item',
      indexKey: 'index'
    }

    expect(loop.items).toBe('items')
    expect(loop.itemKey).toBe('item')
    expect(loop.indexKey).toBe('index')
  })
})
