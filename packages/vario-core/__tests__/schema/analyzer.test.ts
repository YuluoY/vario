import { describe, it, expect } from 'vitest'
import { analyzeSchema, findNodes, findNode, findPathById } from '../../src/schema/analyzer'

describe('Schema Analyzer (Core)', () => {
  const createTestSchema = () => ({
    type: 'Container',
    children: [
      { type: 'Input', id: 'input-1', props: { label: 'Name' } },
      { type: 'Input', id: 'input-2', props: { label: 'Email' } },
      {
        type: 'Form',
        children: [
          { type: 'Button', id: 'btn-submit' }
        ]
      }
    ]
  })

  describe('analyzeSchema', () => {
    it('should collect correct stats', () => {
      const schema = createTestSchema()
      const result = analyzeSchema(schema)

      expect(result.stats.nodeCount).toBe(5) // Container + 2 Inputs + Form + Button
      expect(result.stats.maxDepth).toBe(2)
    })

    it('should build ID index', () => {
      const schema = createTestSchema()
      const result = analyzeSchema(schema)

      expect(result.index.idMap.get('input-1')).toBe('children.0')
      expect(result.index.idMap.get('input-2')).toBe('children.1')
      expect(result.index.idMap.get('btn-submit')).toBe('children.2.children.0')
    })

    it('should support custom onNode callback', () => {
      const schema = createTestSchema()
      const visited: string[] = []

      analyzeSchema(schema, {
        onNode: (node, path) => {
          visited.push(path)
        }
      })

      expect(visited).toHaveLength(5)
      expect(visited).toContain('')
      expect(visited).toContain('children.0')
    })

    it('should optionally build path map', () => {
      const schema = createTestSchema()
      const result = analyzeSchema(schema, { buildPathMap: true })

      expect(result.index.pathMap).toBeDefined()
      expect(result.index.pathMap?.get('children.0')).toEqual(
        expect.objectContaining({ type: 'Input', id: 'input-1' })
      )
    })
  })

  describe('findNodes', () => {
    it('should find all matching nodes', () => {
      const schema = createTestSchema()
      const results = findNodes(schema, (node) => node.type === 'Input')

      expect(results).toHaveLength(2)
      expect(results[0].path).toBe('children.0')
      expect(results[1].path).toBe('children.1')
    })

    it('should return empty array if no matches', () => {
      const schema = createTestSchema()
      const results = findNodes(schema, (node) => node.type === 'NonExistent')

      expect(results).toHaveLength(0)
    })
  })

  describe('findNode', () => {
    it('should find first matching node and stop traversal', () => {
      const schema = createTestSchema()
      const result = findNode(schema, (node) => node.type === 'Form')

      expect(result).not.toBeNull()
      expect(result?.path).toBe('children.2')
      expect(result?.node.type).toBe('Form')
    })

    it('should return null if no match', () => {
      const schema = createTestSchema()
      const result = findNode(schema, (node) => node.type === 'NonExistent')

      expect(result).toBeNull()
    })
  })

  describe('findPathById', () => {
    it('should find path by ID', () => {
      const schema = createTestSchema()
      
      expect(findPathById(schema, 'input-1')).toBe('children.0')
      expect(findPathById(schema, 'btn-submit')).toBe('children.2.children.0')
    })

    it('should return null for non-existent ID', () => {
      const schema = createTestSchema()
      expect(findPathById(schema, 'non-existent')).toBeNull()
    })
  })
})
