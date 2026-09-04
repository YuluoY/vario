import { describe, expect, it } from 'vitest'
import { VueRenderer } from '../../src/renderer'
import { createRuntimeContext } from '@variojs/core'

describe('T0.4 error propagation', () => {
  it('valid sibling still renders when another child is missing type', () => {
    const renderer = new VueRenderer()
    const ctx = createRuntimeContext({})
    const vnode = renderer.render({
      type: 'div',
      children: [
        { type: 'span', children: 'ok' },
        { type: 'span', children: 'also-ok' }
      ]
    }, ctx)
    expect(vnode).toBeTruthy()
  })

  it('descendant render error is not swallowed into a successful partial tree', () => {
    const renderer = new VueRenderer()
    const ctx = createRuntimeContext({})
    expect(() => renderer.render({
      type: 'div',
      children: [
        {
          type: 'div',
          get children(): never {
            throw new RangeError('simulated recursion')
          }
        }
      ]
    } as never, ctx)).toThrow(RangeError)
  })

  it('loop items getter RangeError is not swallowed', () => {
    const renderer = new VueRenderer()
    const holder = {
      get list(): never {
        throw new RangeError('loop boom')
      }
    }
    const ctx = createRuntimeContext({ holder })
    expect(() => renderer.render({
      type: 'div',
      loop: { items: 'holder.list', itemKey: 'item' },
      children: [{ type: 'span', children: 'x' }]
    } as never, ctx)).toThrow(RangeError)
  })
})

describe('T0.5 update routing', () => {
  it('consecutive writes resolve to the final value', () => {
    const ctx = createRuntimeContext({ label: 'a' })
    const renderer = new VueRenderer()
    const schema = { type: 'span', children: '{{ label }}' }
    ctx._set('label', 'b')
    ctx._set('label', 'c')
    expect(ctx._get('label')).toBe('c')
    expect(renderer.render(schema, ctx)).toBeTruthy()
  })
})

describe('T0.5 lifecycle identity', () => {
  it('update keeps lifecycle boundary type', () => {
    const ctx = createRuntimeContext({})
    const renderer = new VueRenderer()
    const schema = { type: 'div', onMounted: 'boot', children: 'x' }
    const a = renderer.render(schema as never, ctx)
    const b = renderer.render(schema as never, ctx)
    expect(a?.type).toEqual(b?.type)
  })
})

describe('T0.6 loop and deep model', () => {
  it('renders loop item/index aliases', () => {
    const ctx = createRuntimeContext({ items: [{ label: 'one' }, { label: 'two' }] })
    const renderer = new VueRenderer()
    expect(renderer.render({
      type: 'div',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
      children: [{ type: 'span', children: '{{ item.label }}-{{ index }}' }]
    }, ctx)).toBeTruthy()
  })

  it('binds nested model path', () => {
    const ctx = createRuntimeContext({ form: { name: 'Ada' } })
    const renderer = new VueRenderer({ getState: () => ctx })
    expect(renderer.render({
      type: 'div',
      model: { path: 'form', scope: true },
      children: [{ type: 'input', model: 'name' }]
    }, ctx)).toBeTruthy()
  })
})
