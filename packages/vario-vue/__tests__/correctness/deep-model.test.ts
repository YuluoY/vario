import { describe, expect, it } from 'vitest'
import { VueRenderer } from '../../src/renderer.js'
import { createRuntimeContext } from '@variojs/core'

describe('T0.6 deep model', () => {
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
