
import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { createSchemaAnalyzer } from '../../src/features/schema-analyzer'

describe('createSchemaAnalyzer', () => {
  const createSchema = () => ({
    type: 'div',
    children: [
      { 
        type: 'Input',
        id: 'name-field',
        props: { label: 'Name' }
      },
      { 
        type: 'Input',
        id: 'age-field',
        props: { label: 'Age' }
      },
      {
        type: 'div',
        children: [
          { type: 'span', id: 'city-field' }
        ]
      }
    ]
  })

  it('collects stats correctly', () => {
    const schema = ref(createSchema())
    const analyzer = createSchemaAnalyzer(schema, { lazy: false })

    expect(analyzer.stats.value.nodeCount).toBeGreaterThan(0)
    // Root(1) + Input(1) + Input(1) + div(1) + span(1) = 5
    expect(analyzer.stats.value.nodeCount).toBe(5)
    expect(analyzer.stats.value.maxDepth).toBe(2)
  })

  it('builds id index', () => {
    const schema = ref(createSchema())
    const analyzer = createSchemaAnalyzer(schema, { lazy: false })

    expect(analyzer.getPathById('name-field')).toBe('children.0')
    expect(analyzer.getPathById('age-field')).toBe('children.1')
    expect(analyzer.getPathById('city-field')).toBe('children.2.children.0')
    expect(analyzer.getPathById('unknown')).toBeUndefined()
  })

  it('supports lazy analysis', async () => {
    const schema = ref(createSchema())
    const onAnalyze = vi.fn()
    const analyzer = createSchemaAnalyzer(schema, { lazy: true, onAnalyze })

    // Initially 0 because lazy
    expect(analyzer.stats.value.nodeCount).toBe(0)
    expect(onAnalyze).not.toHaveBeenCalled()

    // Trigger analysis by requesting data
    analyzer.getPathById('name-field')
    
    expect(onAnalyze).toHaveBeenCalled()
    expect(analyzer.stats.value.nodeCount).toBe(5)
  })

  it('reacts to schema changes', async () => {
    const schema = ref<any>(createSchema())
    const analyzer = createSchemaAnalyzer(schema, { lazy: false })

    expect(analyzer.getPathById('email')).toBeUndefined()

    schema.value = {
      type: 'Form',
      children: [
        { type: 'Input', id: 'email' }
      ]
    }
    
    await nextTick()
    
    // Explicitly refresh or access data to ensure fresh if it was dirty
    expect(analyzer.getPathById('email')).toBe('children.0')
    expect(analyzer.stats.value.nodeCount).toBe(2) // Root + email
  })
})
