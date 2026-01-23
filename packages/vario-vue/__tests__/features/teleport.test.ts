/**
 * Teleport 功能单元测试
 * 
 * 测试：
 * - createTeleport 创建 Teleport VNode
 * - shouldTeleport 判断函数
 * - 目标选择器
 * - 子节点处理
 */

import { describe, it, expect } from 'vitest'
import { h } from 'vue'
import { createTeleport, shouldTeleport } from '../../src/features/teleport.js'

describe('createTeleport', () => {
  describe('基础功能', () => {
    it('应该创建 Teleport 到 body（使用 true）', () => {
      const child = h('div', {}, 'Hello')
      const result = createTeleport(true, child)

      expect(result).not.toBeNull()
      expect((result as any).type.name).toBe('Teleport')
      expect((result as any).props.to).toBe('body')
    })

    it('应该创建 Teleport 到指定选择器', () => {
      const child = h('div', {}, 'Hello')
      const result = createTeleport('#modal', child)

      expect(result).not.toBeNull()
      expect((result as any).props.to).toBe('#modal')
    })

    it('应该处理单个子节点', () => {
      const child = h('div', { id: 'test' }, 'Hello')
      const result = createTeleport('body', child)

      expect(result).not.toBeNull()
      expect(Array.isArray((result as any).children)).toBe(true)
      expect((result as any).children).toHaveLength(1)
    })

    it('应该处理多个子节点', () => {
      const children = [
        h('div', {}, 'Child 1'),
        h('div', {}, 'Child 2'),
        h('div', {}, 'Child 3')
      ]

      const result = createTeleport('body', children)

      expect(result).not.toBeNull()
      expect(Array.isArray((result as any).children)).toBe(true)
      expect((result as any).children).toHaveLength(3)
    })

    it('应该处理 null 子节点', () => {
      const result = createTeleport('body', null)

      expect(result).not.toBeNull()
      expect(Array.isArray((result as any).children)).toBe(true)
      expect((result as any).children).toHaveLength(0)
    })
  })

  describe('不同目标', () => {
    it('应该支持 ID 选择器', () => {
      const child = h('div', {}, 'Hello')
      const result = createTeleport('#app', child)

      expect((result as any).props.to).toBe('#app')
    })

    it('应该支持类选择器', () => {
      const child = h('div', {}, 'Hello')
      const result = createTeleport('.modal-container', child)

      expect((result as any).props.to).toBe('.modal-container')
    })

    it('应该支持元素选择器', () => {
      const child = h('div', {}, 'Hello')
      const result = createTeleport('body', child)

      expect((result as any).props.to).toBe('body')
    })
  })
})

describe('shouldTeleport', () => {
  it('应该返回 true 当 target 是字符串', () => {
    expect(shouldTeleport('body')).toBe(true)
    expect(shouldTeleport('#modal')).toBe(true)
    expect(shouldTeleport('.container')).toBe(true)
  })

  it('应该返回 true 当 target 是 true', () => {
    expect(shouldTeleport(true)).toBe(true)
  })

  it('应该返回 false 当 target 是 undefined', () => {
    expect(shouldTeleport(undefined)).toBe(false)
  })

  it('应该返回 false 当 target 是 false', () => {
    expect(shouldTeleport(false)).toBe(false)
  })
})
