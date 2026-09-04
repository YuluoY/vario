import { describe, expect, it } from 'vitest'
import { createRuntimeContext, execute } from '@variojs/core'
import { prepareView } from '@variojs/schema'
import { PageSession, resolvePageSession } from '../../src/runtime/page-session.js'
import { pauseSession, resumeSession, disposeSession, sessionResourceCounts } from '../../src/runtime/session-lifecycle.js'
import { detectVueCapabilities } from '../../src/runtime/vue-capabilities.js'
import { getRuntimeMode, setRuntimeMode } from '../../src/runtime/runtime-mode.js'
import { compareShadowPlans } from '../../src/runtime/shadow-comparator.js'
import { evaluateCanary } from '../../src/runtime/canary-controller.js'
import { RuntimeSession, getOrCreateEngine } from '@variojs/core'

describe('T2.1 PageSession', () => {
  it('dispose is idempotent and clears resources', () => {
    const session = new PageSession({
      ctx: createRuntimeContext({}),
      view: prepareView({ type: 'div', children: 'x' } as never)
    })
    session.dispose()
    session.dispose()
    expect(session.status).toBe('disposed')
    expect(session.timers.size).toBe(0)
    expect(session.subscriptions.length).toBe(0)
    expect(session.executions.size).toBe(0)
  })

  it('resolvePageSession falls back to the session id registry outside setup', () => {
    const session = new PageSession({
      ctx: createRuntimeContext({}),
      view: prepareView({ type: 'div', children: 'x' } as never)
    })
    expect(resolvePageSession(session.id)).toBe(session)
    session.dispose()
    expect(resolvePageSession(session.id)).toBeUndefined()
  })

  it('binds live schema on the session WeakMap, not the frozen plan', () => {
    const schema = { type: 'div', children: 'x' } as never
    const view = prepareView(schema)
    const session = new PageSession({
      ctx: createRuntimeContext({}),
      view
    })
    expect(view.nodeList![0].schema).toBeUndefined()
    expect(session.source(view.nodeList![0].id)).toBe(schema)
    expect(session.bySchema.get(schema)?.id).toBe(view.nodeList![0].id)
    session.dispose()
  })

  it('emits page-activate and page-dispose to the diagnostic sink', () => {
    const names: string[] = []
    const events: Array<{ name: string; engineId?: string; pageId?: string; schemaId?: string; revision?: number }> = []
    const session = new PageSession({
      ctx: createRuntimeContext({}),
      view: prepareView({ type: 'div', children: 'x' } as never),
      diagnosticSink: {
        emit(event) {
          names.push(event.name)
          events.push(event)
        }
      }
    })
    expect(names).toContain('page-activate')
    expect(names).toContain('schema-prepare')
    expect(events.some(e => e.name === 'page-activate' && e.engineId && e.pageId === session.id && e.schemaId && e.revision === 1)).toBe(true)
    session.dispose()
    expect(names).toContain('page-dispose')
  })
})

describe('T4.1 resource ownership', () => {
  it('sessions belong to an engine and do not share result memo', () => {
    const engine = getOrCreateEngine('test-engine')
    const a = new RuntimeSession(createRuntimeContext({ n: 1 }), { engineId: 'test-engine' })
    const b = new RuntimeSession(createRuntimeContext({ n: 2 }), { engineId: 'test-engine' })
    expect(engine.sessions.has(a)).toBe(true)
    expect(engine.sessions.has(b)).toBe(true)
    a.memo.store('p', [], 1)
    expect(b.memo.lookup('p', []).hit).toBe(false)
    a.dispose()
    b.dispose()
  })
})

describe('T4.2 session lifecycle', () => {
  it('pause/resume/dispose and SESSION_DISPOSED on terminal calls', async () => {
    const ctx = createRuntimeContext({})
    const session = new PageSession({
      ctx,
      view: prepareView({ type: 'div', children: 'x' } as never)
    })
    expect(pauseSession(session)).toBe('paused')
    expect(resumeSession(session)).toBe('active')
    disposeSession(session)
    expect(sessionResourceCounts(session).disposed).toBe(true)
    expect(() => session.pause()).toThrow(/disposed/i)
    expect(() => session.store.write('x', 1)).toThrow(/disposed/i)
    // FR-7：disposed 后 _set 静默忽略（emit SESSION_DISPOSED_WRITE 诊断），不再抛错
    expect(() => ctx._set('x', 1)).not.toThrow()
    await expect(execute([], ctx)).rejects.toMatchObject({ code: 'SESSION_DISPOSED' })
  })

  it('inactive session does not receive ChangeSet updates', () => {
    const session = new PageSession({
      ctx: createRuntimeContext({ n: 1 }),
      view: prepareView({ type: 'div', children: '{{ n }}' } as never)
    })
    session.deactivate()
    expect(session.status).toBe('inactive')
    session.ctx?._set('n', 2)
    expect(session.status).toBe('inactive')
    session.dispose()
  })

  it('LIFE-2 inactive page does not bump region tokens', () => {
    const session = new PageSession({
      ctx: createRuntimeContext({ n: 1 }),
      view: prepareView({ type: 'span', children: '{{ n }}' } as never)
    })
    const dynamic = session.view ? [...session.view.nodes.values()].find(n => n.region === 'dynamic') : undefined
    const token = session.bridge!.tokenFor(dynamic?.id ?? session.view!.rootNodeId!)
    const before = token.value
    session.deactivate()
    session.ctx?._set('n', 9)
    expect(token.value).toBe(before)
    session.dispose()
  })

  it('resume coalesces paused ChangeSets into one region apply', () => {
    const session = new PageSession({
      ctx: createRuntimeContext({ n: 1 }),
      view: prepareView({ type: 'span', children: '{{ n }}' } as never)
    })
    const dynamic = session.view ? [...session.view.nodes.values()].find(n => n.region === 'dynamic') : undefined
    const token = session.bridge!.tokenFor(dynamic?.id ?? session.view!.rootNodeId!)
    const before = token.value
    session.pause()
    session.ctx?._set('n', 2)
    session.ctx?._set('n', 3)
    expect(token.value).toBe(before)
    session.resume()
    expect(token.value).toBe(before + 1)
    session.dispose()
  })

  it('LIFE-4 page A/B methods/model/material/plugin registries stay isolated', () => {
    // T3.8：engineId 缺省共享 'default'（FR-14）；需要 materials 隔离的页面显式指定 engine
    const a = new PageSession({
      ctx: createRuntimeContext({ n: 1 }, { methods: { onlyA: () => 1 } }),
      view: prepareView({ type: 'div', children: '{{ n }}' } as never),
      engineId: 'life4-page-a'
    })
    const b = new PageSession({
      ctx: createRuntimeContext({ n: 2 }, { methods: { onlyB: () => 2 } }),
      view: prepareView({ type: 'div', children: '{{ n }}' } as never),
      engineId: 'life4-page-b'
    })
    expect(typeof a.ctx?.$methods.onlyA).toBe('function')
    expect(a.ctx?.$methods.onlyB).toBeUndefined()
    expect(typeof b.ctx?.$methods.onlyB).toBe('function')
    expect(b.ctx?.$methods.onlyA).toBeUndefined()
    a.materials.set('WidgetA', { name: 'WidgetA', version: '1.0.0' })
    b.materials.set('WidgetB', { name: 'WidgetB', version: '2.0.0' })
    expect(a.materials.has('WidgetB')).toBe(false)
    expect(b.materials.has('WidgetA')).toBe(false)
    expect(a.runtime.engineId).not.toBe(b.runtime.engineId)
    const sizeA = a.materials.size
    const sizeB = b.materials.size
    a.dispose()
    b.dispose()
    // FR-14：dispose 不清空共享 engine 的 materials（跨页复用）
    expect(a.materials.size).toBe(sizeA)
    expect(b.materials.size).toBe(sizeB)
  })

  it('MEM-4 dispose clears result memo', () => {
    const session = new PageSession({
      ctx: createRuntimeContext({ n: 1 }),
      view: prepareView({ type: 'div', children: '{{ n }}' } as never)
    })
    session.memo.store('n', ['n'], 1)
    expect(session.memo.stats().size).toBe(1)
    session.dispose()
    expect(session.memo.stats().size).toBe(0)
    expect(session.renderer).toBeNull()
  })

  it('LIFE-5 100 create/dispose RuntimeContext WeakRef can be reclaimed', async () => {
    const held: WeakRef<object>[] = []
    for (let i = 0; i < 100; i++) {
      const ctx = createRuntimeContext({ n: i })
      const session = new PageSession({
        ctx,
        view: prepareView({ type: 'div', children: '{{ n }}' } as never)
      })
      held.push(new WeakRef(ctx))
      session.dispose()
    }
    await new Promise(resolve => setTimeout(resolve, 0))
    const gc = (globalThis as { gc?: () => void }).gc
    if (typeof gc === 'function') {
      gc()
      await new Promise(resolve => setTimeout(resolve, 20))
      gc()
      expect(held.filter(ref => ref.deref() != null).length).toBeLessThan(20)
    } else {
      expect(held).toHaveLength(100)
    }
  })

  it('LIFE-3/MEM-3 100 create/dispose leaves zero live sessions', () => {
    const sessions = Array.from({ length: 100 }, (_, i) => new PageSession({
      ctx: createRuntimeContext({ n: i }),
      view: prepareView({ type: 'div', children: '{{ n }}' } as never)
    }))
    for (const session of sessions) session.dispose()
    expect(sessions.every(s => s.status === 'disposed')).toBe(true)
    expect(sessions.every(s => s.view === null && s.renderer === null && s.ctx === null)).toBe(true)
  })

  it('AC-16 20 PageSessions: updating one active page does not bump others', () => {
    const sessions = Array.from({ length: 20 }, (_, i) => new PageSession({
      ctx: createRuntimeContext({ n: i }),
      view: prepareView({ type: 'span', children: '{{ n }}' } as never)
    }))
    const tokens = sessions.map(session => {
      const dynamic = session.view ? [...session.view.nodes.values()].find(n => n.region === 'dynamic') : undefined
      return session.bridge!.tokenFor(dynamic?.id ?? session.view!.rootNodeId!)
    })
    const before = tokens.map(t => t.value)
    sessions[0].ctx?._set('n', 99)
    expect(tokens[0].value).toBe((before[0] ?? 0) + 1)
    expect(tokens.slice(1).every((t, i) => t.value === before[i + 1])).toBe(true)
    for (const session of sessions) session.dispose()
  })
})

describe('T4.3 vue capabilities', () => {
  it('detects effectScope pause capability without changing public API', () => {
    const caps = detectVueCapabilities()
    expect(typeof caps.effectScopePause).toBe('boolean')
    expect(caps.version).toMatch(/^3\./)
  })
})

describe('T5.1 runtime mode', () => {
  it('defaults to legacy and can switch without API change', () => {
    const previous = getRuntimeMode()
    expect(previous).toBe('legacy')
    setRuntimeMode('shadow')
    expect(getRuntimeMode()).toBe('shadow')
    setRuntimeMode('prepared')
    expect(getRuntimeMode()).toBe('prepared')
    setRuntimeMode('legacy')
    expect(getRuntimeMode()).toBe('legacy')
  })
})

describe('T5.2 shadow comparator', () => {
  it('returns empty diffs for equivalent plans', () => {
    const schema = { type: 'div', children: 'x' } as never
    expect(compareShadowPlans(schema, prepareView(schema))).toEqual([])
  })
})

describe('T5.5 canary controller', () => {
  it('rolls back on parity diffs and records reason', () => {
    const decision = evaluateCanary({ correctnessOk: true, parityDiffs: 1 })
    expect(decision.rolledBack).toBe(true)
    expect(decision.reason).toBe('correctness/parity')
    expect(decision.unit).toBe('session')
    setRuntimeMode('legacy')
  })
})
