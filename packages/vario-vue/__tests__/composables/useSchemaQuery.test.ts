
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useSchemaQuery } from '../../src/composables/useSchemaQuery'
import { createSchemaAnalyzer } from '../../src/features/schema-analyzer'

describe('useSchemaQuery', () => {
  const schema = ref({
    type: 'Container',
    children: [
      {
        type: 'Form',
        props: { name: 'userForm' },
        children: [
          { type: 'Input', id: 'user-name', props: { label: 'Name' } },
          { type: 'Input', id: 'user-age', props: { min: 18 } }
        ]
      },
      {
        type: 'List',
        children: [
          {
            type: 'Tag',
            id: 'tag-item',
            children: 'Tag Text' // Text node should be ignored by analyzer
          }
        ]
      }
    ]
  })

  // Mock analyzer
  const analyzer = createSchemaAnalyzer(schema, { lazy: false })
  
  // Mock patchNode
  const patchNode = vi.fn((path, patch) => {
    // Simulate patch? We can't really simulate deep patch easily on ref without lodash.set
    // For unit test, we verify the call.
  })

  const api = useSchemaQuery(schema, analyzer, { patchNode })

  it('findById finds node and returns wrapper', () => {
    const node = api.findById('user-name')
    expect(node).not.toBeNull()
    expect(node?.path).toBe('children.0.children.0')
    const props = node?.get('props') as any
    expect(props.label).toBe('Name')
  })

  it('findById wrapper patch calls patchNode', () => {
    const node = api.findById('user-name')
    node?.patch({ props: { label: 'New Name' } })
    expect(patchNode).toHaveBeenCalledWith(
      'children.0.children.0',
      { props: { label: 'New Name' } }
    )
  })

  it('find returns first match', () => {
    // Find Input type
    const node = api.find(n => n.type === 'Input')
    expect(node).not.toBeNull()
    // It could be name or age, traversal order is children 0 -> children 0 (name) then children 1 (age)
    expect(node?.path).toBe('children.0.children.0')
  })

  it('findAll returns all matches', () => {
    // Find all Inputs
    const nodes = api.findAll(n => n.type === 'Input')
    expect(nodes.length).toBe(2)
    const ids = nodes.map(n => n.get('id')).sort()
    expect(ids).toEqual(['user-age', 'user-name'])
  })

  it('wrapper parent returns parent wrapper', () => {
    const node = api.findById('user-name') // children.0.children.0
    const parent = node?.parent()
    
    expect(parent).not.toBeNull()
    expect(parent?.path).toBe('children.0')
    expect(parent?.get('type')).toBe('Form')
  })
})
