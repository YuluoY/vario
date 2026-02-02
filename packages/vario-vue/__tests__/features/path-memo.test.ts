/**
 * path-memo 单元测试
 *
 * 测试 buildSchemaId、buildDepsKey、getCacheKey、PathMemoCache、hasLoopInSubtree
 */

import { describe, it, expect } from 'vitest'
import {
  buildSchemaId,
  buildDepsKey,
  getCacheKey,
  PathMemoCache,
  hasLoopInSubtree,
  hasModelInSubtree
} from '../../src/features/path-memo.js'
import type { SchemaNode } from '@variojs/schema'
import { h } from 'vue'

describe('path-memo', () => {
  describe('buildSchemaId', () => {
    it('应包含 type、cond、show、loop、children 长度', () => {
      expect(buildSchemaId({ type: 'div' })).toContain('div')
      expect(buildSchemaId({ type: 'div', cond: 'x' })).toContain('x')
      expect(buildSchemaId({ type: 'span', show: 'visible' })).toContain('visible')
      expect(buildSchemaId({ type: 'div', children: [{ type: 'span' }, { type: 'p' }] })).toContain('2')
    })
  })

  describe('buildDepsKey', () => {
    it('应拼接 cond/show 求值结果', () => {
      expect(buildDepsKey(true, true)).toBe('true|true')
      expect(buildDepsKey(false, undefined)).toBe('false|undefined')
    })
  })

  describe('getCacheKey', () => {
    it('应拼接 path、schemaId、depsKey', () => {
      const key = getCacheKey('0', 'div|||2', 'true|true')
      expect(key).toBe('0|div|||2|true|true')
    })
  })

  describe('PathMemoCache', () => {
    it('应能 set/get/clear', () => {
      const cache = new PathMemoCache()
      const vnode = h('div', null, 'x')
      cache.set('k1', vnode)
      expect(cache.get('k1')).toBe(vnode)
      expect(cache.get('k2')).toBeUndefined()
      cache.clear()
      expect(cache.get('k1')).toBeUndefined()
    })
  })

  describe('hasLoopInSubtree', () => {
    it('自身有 loop 时返回 true', () => {
      expect(hasLoopInSubtree({ type: 'div', loop: { items: 'list', itemKey: 'item' } })).toBe(true)
    })
    it('自身无 loop、无 children 时返回 false', () => {
      expect(hasLoopInSubtree({ type: 'span' })).toBe(false)
    })
    it('子节点有 loop 时返回 true', () => {
      expect(
        hasLoopInSubtree({
          type: 'div',
          children: [{ type: 'span' }, { type: 'div', loop: { items: 'x', itemKey: 'y' } }]
        })
      ).toBe(true)
    })
    it('子节点都无 loop 时返回 false', () => {
      expect(
        hasLoopInSubtree({
          type: 'div',
          children: [{ type: 'span' }, { type: 'p' }]
        })
      ).toBe(false)
    })
  })

  describe('hasModelInSubtree', () => {
    it('自身有 model 路径时返回 true', () => {
      expect(hasModelInSubtree({ type: 'input', model: 'name' })).toBe(true)
    })
    it('自身 model 为 scope 仅作用域时返回 false（本节点无绑定）', () => {
      expect(hasModelInSubtree({ type: 'div', model: { path: 'form', scope: true } })).toBe(false)
    })
    it('自身 model 为对象且非 scope 时返回 true', () => {
      expect(hasModelInSubtree({ type: 'input', model: { path: 'name' } })).toBe(true)
    })
    it('子节点有 model 时返回 true', () => {
      expect(
        hasModelInSubtree({
          type: 'div',
          children: [{ type: 'input', model: 'name' }]
        })
      ).toBe(true)
    })
    it('自身和子节点都无 model 时返回 false', () => {
      expect(hasModelInSubtree({ type: 'div', children: [{ type: 'span' }] })).toBe(false)
    })
  })
})
