/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeContext } from '@variojs/core'
import { createSsrSession } from '../../src/ssr/index.js'

describe('T4.4 SSR session factory', () => {
  it('creates an independent session per request', () => {
    const a = createSsrSession(createRuntimeContext({ n: 1 }), { type: 'span', children: '{{ n }}' } as never)
    const b = createSsrSession(createRuntimeContext({ n: 2 }), { type: 'span', children: '{{ n }}' } as never)
    expect(a.id).not.toBe(b.id)
    expect(a.ctx?._get('n')).toBe(1)
    expect(b.ctx?._get('n')).toBe(2)
    a.dispose()
    b.dispose()
    expect(a.status).toBe('disposed')
    expect(b.status).toBe('disposed')
  })
})

describe('T4.6 request isolation', () => {
  it('50 sessions keep independent state', () => {
    const sessions = Array.from({ length: 50 }, (_, i) =>
      createSsrSession(createRuntimeContext({ n: i }), { type: 'span', children: '{{ n }}' } as never)
    )
    sessions.forEach((s, i) => expect(s.ctx?._get('n')).toBe(i))
    for (const s of sessions) s.dispose()
    expect(sessions.every(s => s.status === 'disposed')).toBe(true)
  })
})

describe('T4.5 SSR render isolation', () => {
  it('does not mutate input schema during prepare/session create', () => {
    const schema = { type: 'div', children: '{{ n }}' }
    const snapshot = JSON.stringify(schema)
    const session = createSsrSession(createRuntimeContext({ n: 1 }), schema as never)
    expect(JSON.stringify(schema)).toBe(snapshot)
    session.dispose()
  })
})

describe('T4.5 renderToString feature fixtures', () => {
  it('SSR HTML matches a second independent session for cond/show/loop/model', async () => {
    const { renderSsrToString } = await import('../../src/ssr/create-ssr-session.js')
    const fixtures: Array<{ schema: object; state: Record<string, unknown> }> = [
      { schema: { type: 'div', cond: '{{ show }}', children: 'shown' }, state: { show: true } },
      { schema: { type: 'div', show: '{{ visible }}', children: 'v' }, state: { visible: true } },
      {
        schema: {
          type: 'ul',
          loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
          children: [{ type: 'li', children: '{{ item }}' }]
        },
        state: { items: ['a', 'b'] }
      },
      { schema: { type: 'span', children: '{{ label }}' }, state: { label: 'Ada' } }
    ]
    for (const fixture of fixtures) {
      const a = await renderSsrToString(fixture.schema as never, createRuntimeContext(fixture.state))
      const b = await renderSsrToString(fixture.schema as never, createRuntimeContext(fixture.state))
      expect(a).toBe(b)
      expect(a.length).toBeGreaterThan(0)
    }
  })

  it('SSR does not mutate persistent state', async () => {
    const { renderSsrToString } = await import('../../src/ssr/create-ssr-session.js')
    const ctx = createRuntimeContext({ n: 1 })
    await renderSsrToString({ type: 'span', children: '{{ n }}' } as never, ctx)
    expect(ctx._get('n')).toBe(1)
  })

  it('SSR-3 applies model default before render', async () => {
    const { renderSsrToString } = await import('../../src/ssr/create-ssr-session.js')
    const schema = { type: 'input', model: { path: 'count', default: 10 } }
    const snapshot = JSON.stringify(schema)
    const ctx = createRuntimeContext({})
    await renderSsrToString(schema as never, ctx)
    expect(JSON.stringify(schema)).toBe(snapshot)
    expect(ctx._get('count')).toBe(10)
  })

  it('SSR-4 empty teleport target is a typed error', async () => {
    const { renderSsrToString } = await import('../../src/ssr/create-ssr-session.js')
    const { ErrorCodes } = await import('@variojs/core')
    await expect(renderSsrToString(
      { type: 'div', teleport: '', children: 'x' } as never,
      createRuntimeContext({})
    )).rejects.toMatchObject({ code: ErrorCodes.TELEPORT_INVALID_TARGET })
  })

  it('hydrate produces 0 hydration mismatch warnings', async () => {
    const { hydrateVarioApp } = await import('../../src/ssr/create-ssr-session.js')
    const warnings: string[] = []
    const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    })
    const root = document.createElement('div')
    document.body.appendChild(root)
    const ctx = createRuntimeContext({ label: 'Ada', items: ['a', 'b'], show: true })
    const schema = {
      type: 'div',
      children: [
        { type: 'span', children: '{{ label }}' },
        { type: 'div', cond: '{{ show }}', children: 'shown' },
        {
          type: 'ul',
          loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
          children: [{ type: 'li', children: '{{ item }}' }]
        }
      ]
    }
    const { app, session } = await hydrateVarioApp(root, schema as never, ctx)
    expect(root.textContent).toContain('Ada')
    expect(warnings.some(w => /hydrat/i.test(w))).toBe(false)
    app.unmount()
    session.dispose()
    warn.mockRestore()
  })
})
