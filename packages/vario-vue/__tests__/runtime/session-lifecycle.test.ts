import { describe, expect, it } from 'vitest'
import { createRuntimeContext, execute } from '@variojs/core'
import { prepareView } from '@variojs/schema'
import { PageSession } from '../../src/runtime/page-session.js'
import { pauseSession, resumeSession, disposeSession, sessionResourceCounts } from '../../src/runtime/session-lifecycle.js'

describe('T4.2 session lifecycle', () => {
  it('pause/resume/dispose is idempotent and terminal calls are SESSION_DISPOSED', async () => {
    const ctx = createRuntimeContext({})
    const session = new PageSession({
      ctx,
      view: prepareView({ type: 'div', children: 'x' } as never)
    })
    expect(pauseSession(session)).toBe('paused')
    expect(resumeSession(session)).toBe('active')
    expect(disposeSession(session)).toBe('disposed')
    expect(sessionResourceCounts(session)).toEqual({
      timers: 0,
      subscriptions: 0,
      executions: 0,
      memo: 0,
      refs: 0,
      disposed: true
    })
    expect(() => session.pause()).toThrow(/disposed/i)
    expect(() => session.store.write('x', 1)).toThrow(/disposed/i)
    // FR-7：disposed 后 _set 静默忽略，不再抛错
    expect(() => ctx._set('x', 1)).not.toThrow()
    await expect(execute([], ctx)).rejects.toMatchObject({ code: 'SESSION_DISPOSED' })
  })

  it('paused ChangeSets apply once on resume', () => {
    const session = new PageSession({
      ctx: createRuntimeContext({ n: 1 }),
      view: prepareView({ type: 'div', children: '{{ n }}' } as never)
    })
    const dynamic = session.view ? [...session.view.nodes.values()].find(n => n.region === 'dynamic') : undefined
    const token = session.bridge!.tokenFor(dynamic?.id ?? session.view!.rootNodeId!)
    const before = token.value
    pauseSession(session)
    session.ctx?._set('n', 2)
    session.ctx?._set('n', 9)
    expect(token.value).toBe(before)
    resumeSession(session)
    expect(token.value).toBe(before + 1)
    disposeSession(session)
  })

  it('paused session execute is a no-op until resume', async () => {
    const ctx = createRuntimeContext({ n: 1 })
    const session = new PageSession({
      ctx,
      view: prepareView({ type: 'div', children: '{{ n }}' } as never)
    })
    pauseSession(session)
    await execute([{ type: 'set', path: 'n', value: 9 } as never], ctx)
    expect(ctx._get('n')).toBe(1)
    resumeSession(session)
    await execute([{ type: 'set', path: 'n', value: 9 } as never], ctx)
    expect(ctx._get('n')).toBe(9)
    disposeSession(session)
  })

  it('inactive session execute is a no-op', async () => {
    const ctx = createRuntimeContext({ n: 1 })
    const session = new PageSession({
      ctx,
      view: prepareView({ type: 'div', children: '{{ n }}' } as never)
    })
    session.deactivate()
    await execute([{ type: 'set', path: 'n', value: 9 } as never], ctx)
    expect(ctx._get('n')).toBe(1)
    session.activate()
    await execute([{ type: 'set', path: 'n', value: 9 } as never], ctx)
    expect(ctx._get('n')).toBe(9)
    disposeSession(session)
  })

  it('MEM-4 memo size is 0 after dispose', () => {
    const session = new PageSession({
      ctx: createRuntimeContext({ n: 1 }),
      view: prepareView({ type: 'div', children: '{{ n }}' } as never)
    })
    session.memo.store('n', ['n'], 1)
    expect(session.memo.stats().size).toBe(1)
    disposeSession(session)
    expect(sessionResourceCounts(session).memo).toBe(0)
  })
})
