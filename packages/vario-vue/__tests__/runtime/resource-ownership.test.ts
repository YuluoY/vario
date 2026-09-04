import { describe, expect, it } from 'vitest'
import { createRuntimeContext, RuntimeSession, getOrCreateEngine } from '@variojs/core'
import { prepareView } from '@variojs/schema'
import { PageSession } from '../../src/runtime/page-session.js'

describe('T4.1 resource ownership', () => {
  it('result memo is session-owned and frozen plans can be shared', () => {
    const engine = getOrCreateEngine('ownership-engine')
    const view = prepareView({ type: 'div', children: 'x' } as never)
    const a = new RuntimeSession(createRuntimeContext({ n: 1 }), { engineId: 'ownership-engine' })
    const b = new RuntimeSession(createRuntimeContext({ n: 2 }), { engineId: 'ownership-engine' })
    expect(engine.sessions.has(a)).toBe(true)
    a.memo.store('p', [], 1)
    expect(b.memo.lookup('p', []).hit).toBe(false)
    const page = new PageSession({ ctx: createRuntimeContext({}), view })
    expect(page.view).toBe(view)
    page.dispose()
    a.dispose()
    b.dispose()
    expect(page.ctx).toBeNull()
  })
})
