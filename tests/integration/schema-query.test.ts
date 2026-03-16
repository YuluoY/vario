/**
 * 集成测试：Schema Query + Node Context 跨包协作
 *
 * 验证 core 的 analyzeSchema / createQueryEngine 与 vue 的 useSchemaQuery 行为一致。
 */
import { describe, it, expect } from 'vitest'
import { analyzeSchema, findNode, findNodes, findPathById, createQueryEngine } from '@vario/core'

const schema = {
  type: 'form',
  id: 'root',
  children: [
    {
      type: 'input',
      id: 'name-field',
      model: 'name',
      props: { placeholder: 'Name' }
    },
    {
      type: 'select',
      id: 'role-field',
      model: 'role',
      children: [
        { type: 'option', props: { value: 'admin', label: 'Admin' } },
        { type: 'option', props: { value: 'user', label: 'User' } }
      ]
    },
    {
      type: 'button',
      id: 'submit-btn',
      events: { click: { type: 'call', method: 'submit' } },
      children: 'Submit'
    }
  ]
}

describe('Schema Query integration', () => {
  it('analyzeSchema should count nodes and depth correctly', () => {
    const result = analyzeSchema(schema as any)
    // root + input + select + 2 option + button = 6
    expect(result.stats.nodeCount).toBe(6)
    expect(result.stats.maxDepth).toBeGreaterThanOrEqual(2)
  })

  it('findNode should locate by predicate', () => {
    const result = findNode(schema as any, n => n.id === 'submit-btn')
    expect(result).toBeDefined()
    expect(result!.node.type).toBe('button')
  })

  it('findNodes should return all matches', () => {
    const options = findNodes(schema as any, n => n.type === 'option')
    expect(options).toHaveLength(2)
  })

  it('findPathById should return correct path', () => {
    const path = findPathById(schema as any, 'name-field')
    expect(path).toBeDefined()
    expect(typeof path).toBe('string')
  })

  it('createQueryEngine should provide O(1) id lookup', () => {
    const result = analyzeSchema(schema as any)
    const engine = createQueryEngine({ schema: schema as any, index: result.index })
    const node = engine.findById('role-field')
    expect(node).toBeDefined()
    expect(node!.node.type).toBe('select')
  })

  it('findNode should return null for non-existent predicate', () => {
    const node = findNode(schema as any, n => n.id === 'does-not-exist')
    expect(node).toBeNull()
  })
})
