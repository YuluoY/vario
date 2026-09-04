import { describe, expect, it } from 'vitest'
import { createRuntimeContext } from '@variojs/core'
import { createSsrSession } from '../../src/ssr/index.js'
import { isolationFixtures } from './fixtures.js'

describe('T4.6 SSR request isolation', () => {
  it('50 concurrent sessions keep independent state and dispose to zero', () => {
    const sessions = isolationFixtures.map(fixture =>
      createSsrSession(createRuntimeContext({ n: fixture.n }), fixture.schema as never)
    )
    sessions.forEach((session, i) => expect(session.ctx?._get('n')).toBe(i))
    expect(new Set(sessions.map(s => s.id)).size).toBe(50)
    for (const session of sessions) session.dispose()
    expect(sessions.every(s => s.status === 'disposed')).toBe(true)
    expect(sessions.every(s => s.timers.size === 0 && s.executions.size === 0)).toBe(true)
  })

  it('AC-19 memo/registry/html/diagnostic stay isolated across 50 SSR sessions', async () => {
    const { renderSsrToString } = await import('../../src/ssr/create-ssr-session.js')
    const { createDiagnosticSink } = await import('@variojs/core')
    const sessions = isolationFixtures.map(fixture =>
      createSsrSession(createRuntimeContext({ n: fixture.n, token: `sec-${fixture.n}` }), fixture.schema as never)
    )
    sessions[0].memo.store('shared-plan', [], 'from-0')
    for (let i = 1; i < sessions.length; i++) {
      expect(sessions[i].memo.lookup('shared-plan', []).hit).toBe(false)
      expect(sessions[i].ctx?._get('n')).toBe(i)
      expect(sessions[i].ctx?._get('token')).toBe(`sec-${i}`)
      expect(sessions[i].renderer).not.toBe(sessions[0].renderer)
    }
    const htmls = await Promise.all(
      isolationFixtures.map(fixture =>
        renderSsrToString(fixture.schema as never, createRuntimeContext({ n: fixture.n }))
      )
    )
    expect(new Set(htmls).size).toBe(50)
    const leaked: string[] = []
    const sink = createDiagnosticSink({
      emit(event) {
        leaked.push(JSON.stringify(event))
      }
    })
    sink.emit({
      name: 'ssr',
      sessionId: sessions[0].id,
      diagnostic: { code: 'X', message: 'token=sec-0', path: 'n', phase: 'ssr' } as never
    })
    expect(leaked[0]).not.toMatch(/sec-0/)
    for (const session of sessions) session.dispose()
  })

  it('SSR-1/5 50 concurrent renders keep isolated component registries', async () => {
    const { renderSsrToString } = await import('../../src/ssr/create-ssr-session.js')
    const { defineComponent, h } = await import('vue')
    const htmls = await Promise.all(
      isolationFixtures.map(fixture => {
        const Marker = defineComponent({
          name: `Mark${fixture.n}`,
          setup: () => () => h('span', `m-${fixture.n}`)
        })
        return renderSsrToString(
          { type: `Mark${fixture.n}` } as never,
          createRuntimeContext({ n: fixture.n }),
          { components: { [`Mark${fixture.n}`]: Marker } }
        )
      })
    )
    expect(new Set(htmls).size).toBe(50)
    expect(htmls[0]).toContain('m-0')
    expect(htmls[49]).toContain('m-49')
    expect(htmls[0]).not.toContain('m-49')
  })

  it('SSR-1 capability overlays stay isolated across SSR sessions', async () => {
    const { registerCapability, evaluate } = await import('@variojs/core')
    // T3.8：engineId 缺省共享 'default'；需要 capability 隔离的 SSR 请求显式指定 engine
    const sessions = isolationFixtures.slice(0, 2).map((fixture, i) =>
      createSsrSession(createRuntimeContext({ n: fixture.n }), fixture.schema as never, { engineId: `ssr-req-${i}` })
    )
    registerCapability({
      name: '$utils.ssrMark',
      pure: true,
      cost: 1,
      inputLimit: 0,
      allowInExpression: true,
      impl: () => 'A'
    }, { engineId: sessions[0].runtime.engineId })
    registerCapability({
      name: '$utils.ssrMark',
      pure: true,
      cost: 1,
      inputLimit: 0,
      allowInExpression: true,
      impl: () => 'B'
    }, { engineId: sessions[1].runtime.engineId })
    expect(evaluate('$utils.ssrMark()', sessions[0].ctx!)).toBe('A')
    expect(evaluate('$utils.ssrMark()', sessions[1].ctx!)).toBe('B')
    for (const session of sessions) session.dispose()
  })

  it('AC-19 50 worker_threads isolate SSR html', async () => {
    const { Worker } = await import('node:worker_threads')
    const { writeFileSync, unlinkSync, existsSync } = await import('node:fs')
    const { join, resolve } = await import('node:path')
    const { tmpdir } = await import('node:os')
    const { pathToFileURL } = await import('node:url')
    const vueEntry = pathToFileURL(resolve(__dirname, '../../dist/index.js')).href
    const coreEntry = pathToFileURL(resolve(__dirname, '../../../vario-core/dist/index.js')).href
    const workerFile = join(tmpdir(), `vario-ssr-w-${process.pid}.mjs`)
    writeFileSync(workerFile, `
import { parentPort, workerData } from 'node:worker_threads'
const { createRuntimeContext } = await import(${JSON.stringify(coreEntry)})
const { renderSsrToString } = await import(${JSON.stringify(vueEntry)})
const html = await renderSsrToString(
  { type: 'span', children: '{{ n }}' },
  createRuntimeContext({ n: workerData.n })
)
parentPort.postMessage(html)
`)
    try {
      const htmls = await Promise.all(Array.from({ length: 50 }, (_, n) => new Promise<string>((resolveHtml, reject) => {
        const worker = new Worker(workerFile, { workerData: { n }, type: 'module' })
        worker.once('message', html => {
          void worker.terminate()
          resolveHtml(html)
        })
        worker.once('error', reject)
      })))
      expect(htmls).toHaveLength(50)
      expect(new Set(htmls).size).toBe(50)
      expect(htmls[0]).toContain('0')
      expect(htmls[49]).toContain('49')
      expect(htmls[0]).not.toContain('49')
    } finally {
      if (existsSync(workerFile)) unlinkSync(workerFile)
    }
  }, 60_000)
})
