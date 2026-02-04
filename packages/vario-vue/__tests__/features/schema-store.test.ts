/**
 * 方案 D：Schema 碎片化 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createSchemaStore,
  joinPath,
  getParentPath,
  getLastSegment,
  isComponentBoundary,
  createPathLookup
} from '../../src/features/schema-store'
import type { SchemaNode } from '@variojs/schema'

describe('schema-store', () => {
  describe('路径工具函数', () => {
    it('joinPath 应正确拼接路径', () => {
      expect(joinPath('', 0)).toBe('0')
      expect(joinPath('', 'children')).toBe('children')
      expect(joinPath('0', 1)).toBe('0.1')
      expect(joinPath('0.1', 2)).toBe('0.1.2')
    })

    it('getParentPath 应返回父路径', () => {
      expect(getParentPath('')).toBe('')
      expect(getParentPath('0')).toBe('')
      expect(getParentPath('0.1')).toBe('0')
      expect(getParentPath('0.1.2')).toBe('0.1')
    })

    it('getLastSegment 应返回最后一段', () => {
      expect(getLastSegment('')).toBe('')
      expect(getLastSegment('0')).toBe('0')
      expect(getLastSegment('0.1')).toBe('1')
      expect(getLastSegment('0.1.2')).toBe('2')
    })
  })

  describe('createSchemaStore', () => {
    let store: ReturnType<typeof createSchemaStore>

    beforeEach(() => {
      store = createSchemaStore()
    })

    it('应正确创建空 store', () => {
      expect(store.getRoot()).toBeUndefined()
      expect(store.keys()).toHaveLength(0)
    })

    it('应正确设置和获取节点', () => {
      const node: SchemaNode = { type: 'div' }
      store.set('', node)
      
      expect(store.has('')).toBe(true)
      expect(store.get('')?.type).toBe('div')
    })

    it('应正确删除节点', () => {
      const node: SchemaNode = { type: 'div' }
      store.set('', node)
      store.delete('')
      
      expect(store.has('')).toBe(false)
      expect(store.get('')).toBeUndefined()
    })

    it('应正确从树初始化', () => {
      const schema: SchemaNode = {
        type: 'div',
        children: [
          { type: 'span', props: { text: 'Hello' } },
          { type: 'button', props: { text: 'Click' } }
        ]
      }

      store.fromTree(schema)

      expect(store.has('')).toBe(true)
      expect(store.has('0')).toBe(true)
      expect(store.has('1')).toBe(true)
      expect(store.get('')?.type).toBe('div')
      expect(store.get('0')?.type).toBe('span')
      expect(store.get('1')?.type).toBe('button')
    })

    it('应正确处理嵌套子节点', () => {
      const schema: SchemaNode = {
        type: 'div',
        children: [
          {
            type: 'section',
            children: [
              { type: 'span' },
              { type: 'button' }
            ]
          }
        ]
      }

      store.fromTree(schema)

      expect(store.has('')).toBe(true)
      expect(store.has('0')).toBe(true)
      expect(store.has('0.0')).toBe(true)
      expect(store.has('0.1')).toBe(true)
      expect(store.get('0.0')?.type).toBe('span')
      expect(store.get('0.1')?.type).toBe('button')
    })

    it('应正确还原为树结构', () => {
      const schema: SchemaNode = {
        type: 'div',
        children: [
          { type: 'span', props: { text: 'Hello' } },
          { type: 'button', props: { text: 'Click' } }
        ]
      }

      store.fromTree(schema)
      const restored = store.toTree()

      expect(restored?.type).toBe('div')
      expect(Array.isArray(restored?.children)).toBe(true)
      expect((restored?.children as SchemaNode[])?.[0]?.type).toBe('span')
      expect((restored?.children as SchemaNode[])?.[1]?.type).toBe('button')
    })

    it('应正确 patch 节点', () => {
      const schema: SchemaNode = {
        type: 'div',
        props: { class: 'old' }
      }

      store.fromTree(schema)
      const versionBefore = store.getVersion('')

      store.patch('', { props: { class: 'new' } })

      expect(store.get('')?.props?.class).toBe('new')
      expect(store.getVersion('')).toBe(versionBefore + 1)
    })

    it('应正确获取子节点路径', () => {
      const schema: SchemaNode = {
        type: 'div',
        children: [
          { type: 'span' },
          { type: 'button' },
          { type: 'input' }
        ]
      }

      store.fromTree(schema)

      const childPaths = store.getChildPaths('')
      expect(childPaths).toEqual(['0', '1', '2'])
    })

    it('应正确清空 store', () => {
      const schema: SchemaNode = {
        type: 'div',
        children: [{ type: 'span' }]
      }

      store.fromTree(schema)
      expect(store.keys().length).toBeGreaterThan(0)

      store.clear()
      expect(store.keys()).toHaveLength(0)
    })

    it('trigger 应更新版本号', () => {
      const node: SchemaNode = { type: 'div' }
      store.set('', node)
      const versionBefore = store.getVersion('')

      store.trigger('')

      expect(store.getVersion('')).toBe(versionBefore + 1)
    })

    it('删除节点应递归删除子节点', () => {
      const schema: SchemaNode = {
        type: 'div',
        children: [
          {
            type: 'section',
            children: [
              { type: 'span' },
              { type: 'button' }
            ]
          }
        ]
      }

      store.fromTree(schema)
      expect(store.has('0')).toBe(true)
      expect(store.has('0.0')).toBe(true)
      expect(store.has('0.1')).toBe(true)

      store.delete('0')

      expect(store.has('0')).toBe(false)
      expect(store.has('0.0')).toBe(false)
      expect(store.has('0.1')).toBe(false)
    })
  })

  describe('isComponentBoundary', () => {
    it('自定义组件应为边界', () => {
      expect(isComponentBoundary({ type: 'ElButton' })).toBe(true)
      expect(isComponentBoundary({ type: 'MyComponent' })).toBe(true)
    })

    it('原生元素不应为边界', () => {
      expect(isComponentBoundary({ type: 'div' })).toBe(false)
      expect(isComponentBoundary({ type: 'span' })).toBe(false)
    })

    it('有 loop 的节点应为边界', () => {
      expect(isComponentBoundary({ 
        type: 'div', 
        loop: { items: '{{ items }}', itemKey: 'item' }
      })).toBe(true)
    })

    it('有生命周期的节点应为边界', () => {
      expect(isComponentBoundary({ 
        type: 'div',
        onMounted: [{ type: 'log', message: 'mounted' }]
      } as any)).toBe(true)
    })

    it('有 provide 的节点应为边界', () => {
      expect(isComponentBoundary({ 
        type: 'div',
        provide: { key: 'value' }
      } as any)).toBe(true)
    })
  })

  describe('createPathLookup', () => {
    it('应创建正确的路径查找映射', () => {
      const schema: SchemaNode = {
        type: 'div',
        children: [
          { type: 'span' },
          { 
            type: 'section',
            children: [{ type: 'button' }]
          }
        ]
      }

      const lookup = createPathLookup(schema)

      expect(lookup.get('')?.type).toBe('div')
      expect(lookup.get('0')?.type).toBe('span')
      expect(lookup.get('1')?.type).toBe('section')
      expect(lookup.get('1.0')?.type).toBe('button')
    })
  })
})
