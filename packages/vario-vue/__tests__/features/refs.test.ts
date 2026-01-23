/**
 * Refs 功能单元测试
 * 
 * 测试：
 * - RefsRegistry 注册和获取
 * - attachRef 函数
 * - ref 合并处理
 * - 多个 ref 注册
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { h, ref } from 'vue'
import { RefsRegistry, attachRef } from '../../src/features/refs.js'
import type { VueSchemaNode } from '../../src/types.js'

describe('RefsRegistry', () => {
  let registry: RefsRegistry

  beforeEach(() => {
    registry = new RefsRegistry()
  })

  describe('注册和获取', () => {
    it('应该注册一个新的 ref', () => {
      const refValue = registry.register('inputRef')
      
      expect(refValue).toBeDefined()
      expect(refValue.value).toBe(null)
    })

    it('应该返回同一个 ref 实例（重复注册）', () => {
      const ref1 = registry.register('inputRef')
      const ref2 = registry.register('inputRef')
      
      expect(ref1).toBe(ref2)
    })

    it('应该获取所有 refs', () => {
      registry.register('ref1')
      registry.register('ref2')
      registry.register('ref3')
      
      const allRefs = registry.getAll()
      
      expect(Object.keys(allRefs)).toHaveLength(3)
      expect(allRefs.ref1).toBeDefined()
      expect(allRefs.ref2).toBeDefined()
      expect(allRefs.ref3).toBeDefined()
    })

    it('应该获取指定的 ref', () => {
      const refValue = registry.register('inputRef')
      const retrieved = registry.get('inputRef')
      
      expect(retrieved).toBe(refValue)
    })

    it('应该返回 undefined 当 ref 不存在时', () => {
      const retrieved = registry.get('nonExistent')
      
      expect(retrieved).toBeUndefined()
    })

    it('应该清除所有 refs', () => {
      registry.register('ref1')
      registry.register('ref2')
      
      expect(Object.keys(registry.getAll())).toHaveLength(2)
      
      registry.clear()
      
      expect(Object.keys(registry.getAll())).toHaveLength(0)
    })
  })
})

describe('attachRef', () => {
  let registry: RefsRegistry
  let schema: VueSchemaNode

  beforeEach(() => {
    registry = new RefsRegistry()
    schema = {
      type: 'div',
      ref: 'containerRef'
    }
  })

  describe('基础功能', () => {
    it('应该为 VNode 添加 ref', () => {
      const vnode = h('div', { class: 'container' }, 'Hello')
      const result = attachRef(vnode, schema, registry)
      
      expect(result).toBe(vnode)
      expect((result as any).ref).toBeDefined()
      
      // 验证 ref 已注册
      const refValue = registry.get('containerRef')
      expect(refValue).toBeDefined()
    })

    it('应该在没有 ref 时返回原 VNode', () => {
      const schemaWithoutRef: VueSchemaNode = {
        type: 'div'
      }
      const vnode = h('div', {}, 'Hello')
      const result = attachRef(vnode, schemaWithoutRef, registry)
      
      expect(result).toBe(vnode)
      // ref 可能为 null 或 undefined
      expect((result as any).ref === null || (result as any).ref === undefined).toBe(true)
    })

    it('应该正确设置 ref 值', () => {
      const vnode = h('div', {}, 'Hello')
      attachRef(vnode, schema, registry)
      
      const refValue = registry.get('containerRef')
      expect(refValue).toBeDefined()
      
      // 模拟组件挂载（使用简单的对象模拟 DOM 元素）
      const mockElement = { tagName: 'DIV' } as any
      const refCallback = (vnode as any).ref
      if (typeof refCallback === 'function') {
        refCallback(mockElement)
      } else {
        (refCallback as any).value = mockElement
      }
      
      expect(refValue!.value).toStrictEqual(mockElement)
    })
  })

  describe('ref 合并', () => {
    it('应该合并已有的 ref（函数形式）', () => {
      const existingRef = vi.fn()
      const vnode = h('div', {}, 'Hello')
      ;(vnode as any).ref = existingRef
      
      attachRef(vnode, schema, registry)
      
      const refValue = registry.get('containerRef')
      const mockElement = { tagName: 'DIV' } as any
      const refCallback = (vnode as any).ref
      
      if (typeof refCallback === 'function') {
        refCallback(mockElement)
      }
      
      expect(existingRef).toHaveBeenCalledWith(mockElement)
      expect(refValue!.value).toStrictEqual(mockElement)
    })

    it('应该合并已有的 ref（Ref 对象形式）', () => {
      const existingRef = ref(null)
      const vnode = h('div', {}, 'Hello')
      ;(vnode as any).ref = existingRef
      
      attachRef(vnode, schema, registry)
      
      const refValue = registry.get('containerRef')
      const mockElement = { tagName: 'DIV' } as any
      const refCallback = (vnode as any).ref
      
      if (typeof refCallback === 'function') {
        refCallback(mockElement)
      } else {
        (refCallback as any).value = mockElement
      }
      
      expect(existingRef.value).toStrictEqual(mockElement)
      expect(refValue!.value).toStrictEqual(mockElement)
    })
  })

  describe('多个 ref', () => {
    it('应该支持多个不同的 ref', () => {
      const schema1: VueSchemaNode = { type: 'div', ref: 'ref1' }
      const schema2: VueSchemaNode = { type: 'div', ref: 'ref2' }
      const schema3: VueSchemaNode = { type: 'div', ref: 'ref3' }
      
      const vnode1 = attachRef(h('div'), schema1, registry)
      const vnode2 = attachRef(h('div'), schema2, registry)
      const vnode3 = attachRef(h('div'), schema3, registry)
      
      const allRefs = registry.getAll()
      expect(Object.keys(allRefs)).toHaveLength(3)
      expect(allRefs.ref1).toBeDefined()
      expect(allRefs.ref2).toBeDefined()
      expect(allRefs.ref3).toBeDefined()
    })
  })
})
