import { describe, it, expect } from 'vitest'
import { createQueryEngine } from '../../src/schema/query-engine'
import { analyzeSchema } from '../../src/schema/analyzer'

describe('Query Engine (Core)', () => {
  const createTestSchema = () => ({
    type: 'App',
    children: [
      {
        type: 'Header',
        id: 'header',
        children: [
          { type: 'Title', id: 'title' }
        ]
      },
      {
        type: 'Body',
        id: 'body',
        children: [
          { type: 'Content', id: 'content' }
        ]
      }
    ]
  })

  describe('findById', () => {
    it('should find node by ID using index', () => {
      const schema = createTestSchema()
      const { index } = analyzeSchema(schema)
      const engine = createQueryEngine({ schema, index })

      const result = engine.findById('title')
      expect(result).not.toBeNull()
      expect(result?.path).toBe('children.0.children.0')
      expect(result?.node.type).toBe('Title')
    })

    it('should return null for non-existent ID', () => {
      const schema = createTestSchema()
      const { index } = analyzeSchema(schema)
      const engine = createQueryEngine({ schema, index })

      const result = engine.findById('non-existent')
      expect(result).toBeNull()
    })

    it('should work with pathMap when available', () => {
      const schema = createTestSchema()
      const { index } = analyzeSchema(schema, { buildPathMap: true })
      const engine = createQueryEngine({ schema, index })

      const result = engine.findById('body')
      expect(result).not.toBeNull()
      expect(result?.node.type).toBe('Body')
    })
  })

  describe('getParent', () => {
    it('should get parent node', () => {
      const schema = createTestSchema()
      const engine = createQueryEngine({ schema })

      const result = engine.getParent('children.0.children.0')
      expect(result).not.toBeNull()
      expect(result?.path).toBe('children.0')
      expect(result?.node.type).toBe('Header')
    })

    it('should skip container properties', () => {
      const schema = createTestSchema()
      const engine = createQueryEngine({ schema })

      // From 'title' at 'children.0.children.0' should skip 'children' and get 'Header'
      const result = engine.getParent('children.0.children.0')
      expect(result?.path).toBe('children.0')
    })

    it('should return null for root node', () => {
      const schema = createTestSchema()
      const engine = createQueryEngine({ schema })

      const result = engine.getParent('')
      expect(result).toBeNull()
    })

    it('should return root for top-level children', () => {
      const schema = createTestSchema()
      const engine = createQueryEngine({ schema })

      // children.0 -> strip .0 -> 'children' (skip) -> '' (root)
      const result = engine.getParent('children.0')
      expect(result).not.toBeNull()
      expect(result?.path).toBe('')
      expect(result?.node.type).toBe('App')
    })
  })
})
