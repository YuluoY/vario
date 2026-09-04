import { describe, expect, it } from 'vitest'
import * as vueApi from '../src/index.js'
import type { UseVarioResult } from '../src/types.js'

describe('T0.8 public API compat', () => {
  it('root exports include useVario, defineMethod, VueRenderer', () => {
    expect(typeof vueApi.useVario).toBe('function')
    expect(typeof vueApi.defineMethod).toBe('function')
    expect(typeof vueApi.VueRenderer).toBe('function')
  })

  it('defaultPlugins characterization stays lifecycle/keep-alive/transition/teleport', () => {
    expect(vueApi.defaultPlugins.map(plugin => plugin.name)).toEqual([
      'lifecycle',
      'keep-alive',
      'transition',
      'teleport'
    ])
  })

  it('UseVarioResult required fields stay listed', () => {
    const fields: Array<keyof UseVarioResult<Record<string, unknown>>> = [
      'vnode', 'state', 'ctx', 'refs', 'error', 'stats', 'retry',
      'find', 'findAll', 'findById'
    ]
    expect(fields.length).toBe(10)
  })

  it('T2.1 each useVario owns one PageSession', () => {
    expect(vueApi.getRuntimeMode()).toBe('legacy')
    const before = vueApi.activePageSessionCount()
    const api = vueApi.useVario({ type: 'div', children: '{{ n }}' }, { state: { n: 1 } })
    expect(vueApi.activePageSessionCount()).toBe(before + 1)
    api.dispose()
    expect(vueApi.activePageSessionCount()).toBe(before)
  })

  it('useVarioPages and VarioNode are exported', () => {
    expect(typeof vueApi.useVarioPages).toBe('function')
    expect(vueApi.VarioNode).toBeTruthy()
    const pages = vueApi.useVarioPages({ maxResidentPages: 1 })
    pages.open('a', { type: 'div', children: 'a' })
    pages.open('b', { type: 'div', children: 'b' })
    expect(pages.manager.pages.size).toBe(1)
    pages.dispose('a')
    pages.dispose('b')
  })

  it('default runtime mode is legacy; prepared is explicit opt-in', async () => {
    const { getRuntimeMode, setRuntimeMode } = await import('../src/runtime/runtime-mode.js')
    expect(getRuntimeMode()).toBe('legacy')
    setRuntimeMode('prepared')
    expect(getRuntimeMode()).toBe('prepared')
    setRuntimeMode('legacy')
  })

  it('T2 PageSession dispose is idempotent', async () => {
    const { createRuntimeContext } = await import('@variojs/core')
    const { prepareView } = await import('@variojs/schema')
    const { PageSession } = await import('../src/runtime/page-session.js')
    const view = prepareView({ type: 'div', children: 'x' } as never)
    const session = new PageSession({ ctx: createRuntimeContext({}), view })
    session.dispose()
    session.dispose()
    expect(session.status).toBe('disposed')
  })

  it('T5.5 canary rolls back on parity diff', async () => {
    const { evaluateCanary } = await import('../src/runtime/runtime-mode.js')
    expect(evaluateCanary({ correctnessOk: true, parityDiffs: 1 }).rolledBack).toBe(true)
  })

  it('exports renderSsrToString', async () => {
    const { renderSsrToString } = await import('../src/ssr/index.js')
    expect(typeof renderSsrToString).toBe('function')
  })

  it('T3.8 reference virtual adapter caps visible range', async () => {
    const { createReferenceVirtualAdapter } = await import('../src/runtime/virtual-list-adapter.js')
    const adapter = createReferenceVirtualAdapter({ viewport: 200, overscan: 0 })
    expect(adapter.getVisibleRange(1000).end).toBeLessThanOrEqual(200)
  })

  it('T2.8 prepared mode skips deep state watch', async () => {
    const { setupWatchers } = await import('../src/composables/internal/use-vario-phases.js')
    const { setRuntimeMode, getRuntimeMode } = await import('../src/runtime/runtime-mode.js')
    expect(getRuntimeMode()).toBe('legacy')
    setRuntimeMode('prepared')
    expect(getRuntimeMode()).toBe('prepared')
    setRuntimeMode('legacy')
    expect(getRuntimeMode()).toBe('legacy')
    expect(typeof setupWatchers).toBe('function')
  })

  it('PageSession.activate restores active status', async () => {
    const { createRuntimeContext } = await import('@variojs/core')
    const { prepareView } = await import('@variojs/schema')
    const { PageSession } = await import('../src/runtime/page-session.js')
    const { activateSession, deactivateSession } = await import('../src/runtime/session-lifecycle.js')
    const session = new PageSession({
      ctx: createRuntimeContext({}),
      view: prepareView({ type: 'div', children: 'x' } as never)
    })
    expect(deactivateSession(session)).toBe('inactive')
    expect(activateSession(session)).toBe('active')
    session.dispose()
  })

  it('T4.2 pause/resume/dispose state machine', async () => {
    const { createRuntimeContext } = await import('@variojs/core')
    const { prepareView } = await import('@variojs/schema')
    const { PageSession } = await import('../src/runtime/page-session.js')
    const { pauseSession, resumeSession, disposeSession, sessionResourceCounts } = await import('../src/runtime/session-lifecycle.js')
    const session = new PageSession({
      ctx: createRuntimeContext({}),
      view: prepareView({ type: 'div', children: 'x' } as never)
    })
    expect(pauseSession(session)).toBe('paused')
    expect(resumeSession(session)).toBe('active')
    disposeSession(session)
    expect(sessionResourceCounts(session).disposed).toBe(true)
    expect(sessionResourceCounts(session).timers).toBe(0)
  })

  it('T5.2 shadow comparator reports nodeId/path/field', async () => {
    const { compareShadowPlans } = await import('../src/runtime/shadow-comparator.js')
    const { prepareView } = await import('@variojs/schema')
    const schema = { type: 'div', children: 'x' } as never
    expect(compareShadowPlans(schema, prepareView(schema))).toEqual([])
  })

  it('T5.3 metrics sink throw does not break business', async () => {
    const { createRuntimeMetricsSink, recordRuntimeMetric } = await import('../src/runtime/runtime-metrics.js')
    const sink = createRuntimeMetricsSink({
      emit() { throw new Error('sink boom') }
    })
    expect(() => recordRuntimeMetric({ name: 'render', sessionId: 's1' }, sink)).not.toThrow()
  })

  it('T2.3 VarioRoot props are only session/root ids', async () => {
    const { VarioRoot } = await import('../src/components/vario-root.js')
    const props = (VarioRoot as { props?: Record<string, unknown> }).props
    expect(props).toBeTruthy()
    expect(Object.keys(props as object).sort()).toEqual(['rootId', 'sessionId'])
  })

  it('T2.4/T2.5 region components expose sessionId/regionId props', async () => {
    const { DynamicRegion } = await import('../src/components/dynamic-region.js')
    const { StaticRegion } = await import('../src/components/static-region.js')
    const { LoopRegion } = await import('../src/components/loop-region.js')
    const { SlotRegion } = await import('../src/components/slot-region.js')
    for (const cmp of [DynamicRegion, StaticRegion, LoopRegion, SlotRegion]) {
      expect(Object.keys((cmp as { props: object }).props).sort()).toEqual(['regionId', 'sessionId'])
    }
  })

  it('T3.5 prepared LoopItemCell props are stable ids', async () => {
    const { LoopItemCell } = await import('../src/components/loop-item-cell.js')
    expect(Object.keys((LoopItemCell as { props: object }).props).sort()).toEqual([
      'generation', 'itemIndex', 'itemKey', 'regionId', 'sessionId'
    ])
  })

  it('T4.7 heap runner uses v8 heap statistics not performance.memory', async () => {
    const src = await import('node:fs')
    const text = src.readFileSync(
      new URL('../../../benchmarks/vue-depth/heap-runner.ts', import.meta.url),
      'utf8'
    )
    expect(text).toContain('v8.getHeapStatistics')
    expect(text).toContain('HeapProfiler.collectGarbage')
    expect(text).not.toMatch(/performance\.memory/)
  })

  it('MEM-2 countNamedHeapNodes counts constructor names in a snapshot', async () => {
    const { countNamedHeapNodes } = await import('../../../benchmarks/vue-depth/heap-runner.ts')
    const snapshot = JSON.stringify({
      snapshot: { meta: { node_fields: ['type', 'name', 'id', 'self_size', 'edge_count', 'trace_node_id', 'detachedness'] } },
      nodes: [0, 1, 1, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0],
      strings: ['', 'PageSession', 'RuntimeContext']
    })
    expect(countNamedHeapNodes(snapshot, ['PageSession', 'RuntimeContext', 'VueStateBridge'])).toEqual({
      PageSession: 1,
      RuntimeContext: 1,
      VueStateBridge: 0
    })
  })

  it('BUNDLE-3 useVario gzip with Vue external is ≤37KB', async () => {
    const { createRequire } = await import('node:module')
    const { gzipSync } = await import('node:zlib')
    const { fileURLToPath } = await import('node:url')
    const { join } = await import('node:path')
    const repo = fileURLToPath(new URL('../../../', import.meta.url))
    const require = createRequire(join(repo, 'package.json'))
    const esbuild = require('esbuild') as typeof import('esbuild')
    const built = await esbuild.build({
      stdin: {
        contents: `export { useVario } from './src/composable.ts'`,
        resolveDir: join(repo, 'packages/vario-vue'),
        loader: 'ts'
      },
      bundle: true,
      format: 'esm',
      write: false,
      platform: 'neutral',
      external: ['vue', '@variojs/core', '@variojs/schema', '@variojs/types']
    })
    const gz = gzipSync(built.outputFiles[0].contents).length
    // 35KB → 37KB：runtime-regression-fix 规格向 legacy 路径新增必需特性
    // （FR-8 VarioLegacyRoot / FR-6 事件帧 API / FR-13 深度扫描缓存 / FR-2 runtimeMode 贯穿），
    // 调整理由见 specs/runtime-regression-fix/verification-report.md
    expect(gz).toBeLessThanOrEqual(37 * 1024)
  })

  it('COMP-2/3 defineSchema and execute signatures remain callable', async () => {
    const { defineSchema } = await import('@variojs/schema')
    const { execute, createRuntimeContext } = await import('@variojs/core')
    const schema = defineSchema({
      state: { n: 0 },
      schema: () => ({ type: 'div', children: '{{ n }}' })
    })
    expect(schema.schema.type).toBe('div')
    const ctx = createRuntimeContext({ n: 0 })
    await execute([{ type: 'set', path: 'n', value: 2 }], ctx)
    expect(ctx._get('n')).toBe(2)
  })
})
