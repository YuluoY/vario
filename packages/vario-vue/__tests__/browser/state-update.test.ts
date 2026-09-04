import { describe, expect, it } from 'vitest'
import { createRuntimeContext } from '@variojs/core'
import { VueRenderer } from '../../src/renderer.js'

describe('browser state-update', () => {
  it('VUE-1 consecutive _set keeps the last value', () => {
    const ctx = createRuntimeContext({ n: 1 })
    ctx._set('n', 2)
    expect(ctx._get('n')).toBe(2)
    const vnode = new VueRenderer().render({ type: 'span', children: '{{ n }}' }, ctx)
    expect(vnode).toBeTruthy()
  })
})
