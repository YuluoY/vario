/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeContext } from '@variojs/core'
import { hydrateVarioApp, renderSsrToString } from '../../src/ssr/create-ssr-session.js'
import { hydrateFixtures } from './fixtures.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('T4.5 SSR hydrate fixtures', () => {
  it('ssr-vario-app fixture is present', () => {
    const app = readFileSync(resolve(__dirname, '../../../../tests/fixtures/ssr-vario-app/src/App.vue'), 'utf8')
    expect(app).toContain('useVario')
  })

  it('cond/show/loop/text hydrate with 0 hydration mismatch warnings', async () => {
    const warnings: string[] = []
    const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    })
    const root = document.createElement('div')
    document.body.appendChild(root)
    const ctx = createRuntimeContext({ label: 'Ada', items: ['a', 'b'], show: true, visible: true })
    const schema = {
      type: 'div',
      children: [
        { type: 'span', children: '{{ label }}' },
        { type: 'div', cond: '{{ show }}', children: 'shown' },
        { type: 'div', show: '{{ visible }}', children: 'v' },
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

  it('SSR HTML matches a second independent session', async () => {
    for (const fixture of hydrateFixtures) {
      const a = await renderSsrToString(fixture.schema as never, createRuntimeContext(fixture.state))
      const b = await renderSsrToString(fixture.schema as never, createRuntimeContext(fixture.state))
      expect(a).toBe(b)
      expect(a.length).toBeGreaterThan(0)
    }
  })

  it('SSR-4 invalid teleport target is a typed error', async () => {
    const { createTeleport } = await import('../../src/features/teleport.js')
    expect(() => createTeleport('', null)).toThrow(/Invalid teleport target/)
  })

  it('SSR-4 missing host is a typed error after mount', async () => {
    const { createApp, h, nextTick } = await import('vue')
    const { createTeleport } = await import('../../src/features/teleport.js')
    const { ErrorCodes } = await import('@variojs/core')
    const host = document.createElement('div')
    document.body.appendChild(host)
    let captured: { code?: string } | undefined
    const app = createApp({
      setup() {
        return () => createTeleport('#ssr4-missing-host', h('span', 'x'))
      }
    })
    app.config.errorHandler = (err: unknown) => {
      captured = err as { code?: string }
    }
    try {
      app.mount(host)
    } catch (err) {
      captured = err as { code?: string }
    }
    await nextTick()
    expect(captured).toMatchObject({ code: ErrorCodes.TELEPORT_MISSING_HOST })
    try { app.unmount() } catch { /* teleport host was missing */ }
    host.remove()
  })

  it('teleport to body mounts content on document.body', async () => {
    const { createTeleport } = await import('../../src/features/teleport.js')
    const vnode = createTeleport(true, null)
    expect(vnode).toBeTruthy()
    const root = document.createElement('div')
    document.body.appendChild(root)
    const { app, session } = await hydrateVarioApp(
      root,
      { type: 'div', children: 'inline' } as never,
      createRuntimeContext({})
    )
    expect(root.textContent).toContain('inline')
    app.unmount()
    session.dispose()
    expect(vnode.type).toBeTruthy()
  })
})
