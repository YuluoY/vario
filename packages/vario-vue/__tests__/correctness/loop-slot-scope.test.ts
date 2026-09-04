import { describe, expect, it } from 'vitest'
import { VueRenderer } from '../../src/renderer.js'
import { createRuntimeContext } from '@variojs/core'

describe('T0.6 loop/slot scope', () => {
  it('renders item/index aliases and nested loop', () => {
    const ctx = createRuntimeContext({
      items: [{ label: 'one', inner: [{ n: 1 }] }, { label: 'two', inner: [{ n: 2 }] }]
    })
    const renderer = new VueRenderer()
    const vnode = renderer.render({
      type: 'div',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
      children: [{
        type: 'div',
        loop: { items: 'item.inner', itemKey: 'cell', indexKey: 'j' },
        children: [{ type: 'span', children: '{{ item.label }}-{{ cell.n }}-{{ index }}' }]
      }]
    }, ctx)
    expect(vnode).toBeTruthy()
    expect(JSON.stringify(vnode)).not.toContain('"children":null')
  })

  it('T3.8 over-budget expansion fails without adapter', async () => {
    const { assertExpandBudget } = await import('../../src/runtime/virtual-list-adapter.js')
    expect(() => assertExpandBudget(10_001, null)).toThrow(/maxExpandedNodes/)
  })

  it('T3.1 scoped slot context is not Object.create(parent RuntimeContext)', async () => {
    const { readFileSync } = await import('node:fs')
    const text = readFileSync(new URL('../../src/features/children-resolver.ts', import.meta.url), 'utf8')
    expect(text).not.toMatch(/Object\.create\(\s*ctx\s*\)/)
    // FR-5：作用域插槽改用 createScopeContext（不注入 $item/$index，与 loop ctx 解耦）
    expect(text).toContain('createScopeContext')
  })
})
