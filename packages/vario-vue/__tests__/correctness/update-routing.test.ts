import { describe, expect, it } from 'vitest'
import { VueRenderer } from '../../src/renderer.js'
import { createRuntimeContext } from '@variojs/core'

describe('T0.5 update routing', () => {
  it('consecutive writes resolve to the final value', () => {
    const ctx = createRuntimeContext({ label: 'a' })
    const renderer = new VueRenderer()
    ctx._set('label', 'b')
    ctx._set('label', 'c')
    expect(ctx._get('label')).toBe('c')
    expect(renderer.render({ type: 'span', children: '{{ label }}' }, ctx)).toBeTruthy()
  })
})
