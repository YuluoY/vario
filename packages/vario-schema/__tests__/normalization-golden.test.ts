import { describe, expect, it } from 'vitest'
import {
  clearNormalizationCache,
  defineSchema,
  normalizeSchema,
} from '../src/index.js'

describe('CONTRACT-2 normalization golden', () => {
  const input = {
    type: ' form ',
    id: 'form-root',
    directives: { focus: true },
    slot: 'default',
    ref: 'formRef',
    onMounted: 'boot',
    meta: { author: 'team' },
    myLib_ext: { animate: true },
    props: {
      label: '',
      hint: null,
      count: 0,
      expr: '{{user.name}}'
    },
    model: {
      path: '  form  ',
      scope: true,
      default: { name: '' },
      lazy: true,
      modifiers: ['trim']
    },
    events: {
      submit: 'save'
    },
    children: [
      { type: 'input', id: 'name', model: 'name', props: { placeholder: '' } }
    ]
  }

  it('preserves id, vue fields, extension, model options and legal empty values', () => {
    const once = normalizeSchema(input as never)
    expect(once.id).toBe('form-root')
    expect(once.directives).toEqual({ focus: true })
    expect(once.slot).toBe('default')
    expect(once.ref).toBe('formRef')
    expect(once.onMounted).toBe('boot')
    expect(once.meta).toEqual({ author: 'team' })
    expect(once.myLib_ext).toEqual({ animate: true })
    expect(once.props).toMatchObject({ label: '', hint: null, count: 0, expr: '{{ user.name }}' })
    expect(once.model).toEqual({
      path: 'form',
      scope: true,
      default: { name: '' },
      lazy: true,
      modifiers: ['trim']
    })
    expect(once.events?.submit).toEqual([{ type: 'call', method: 'save' }])
  })

  it('normalize(normalize(x)) is deeply equal', () => {
    const once = normalizeSchema(input as never)
    const twice = normalizeSchema(once)
    expect(twice).toEqual(once)
  })

  it('clearNormalizationCache actually drops WeakMap entries', () => {
    const node = { type: 'div', id: 'cached', props: { a: 1 } }
    const first = normalizeSchema(node as never)
    const second = normalizeSchema(node as never)
    expect(second).toBe(first)
    clearNormalizationCache()
    const third = normalizeSchema(node as never)
    expect(third).not.toBe(first)
    expect(third).toEqual(first)
  })

  it('defineSchema golden keeps queryable id and model options', () => {
    const view = defineSchema({
      state: { name: '' },
      schema() {
        return {
          type: 'div',
          id: 'root',
          model: { path: 'form', default: { name: '' }, lazy: true },
          children: [{ type: 'input', id: 'name', model: 'name', props: { placeholder: '' } }]
        }
      }
    })
    expect(view.schema.id).toBe('root')
    expect(view.schema.model).toMatchObject({ path: 'form', default: { name: '' }, lazy: true })
    expect((view.schema.children as Array<{ id?: string }>)[0].id).toBe('name')
    expect((view.schema.children as Array<{ props?: { placeholder?: string } }>)[0].props?.placeholder).toBe('')
  })
})
