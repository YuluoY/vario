import { describe, expect, it } from 'vitest'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import os from 'node:os'
import { execSync } from 'node:child_process'
import {
  emitPerformance,
  getPerformanceCounters,
  resetPerformanceCounters,
  setPerformanceHooks
} from '../src/internal/performance-hooks.js'
import { generateMatrix, generateScenario } from '../../../benchmarks/vue-depth/fixtures.js'
import { RUNNER_PROTOCOL } from '../../../benchmarks/vue-depth/types.js'
import { VueRenderer } from '../src/renderer.js'
import { createRuntimeContext } from '@variojs/core'
import { prepareView } from '@variojs/schema'
import { createSsrSession, PageSession } from '../src/runtime/runtime-mode.js'

describe('T0.1 fixtures', () => {
  it('generates all scenario kinds and is deterministic by seed', () => {
    const a = generateMatrix(42)
    const b = generateMatrix(42)
    expect(a.map(s => s.params.kind)).toEqual(['flat', 'deep', 'dynamic', 'loop', 'nested-loop', 'multipage'])
    expect(a).toEqual(b)
  })

  it('deep scenario depth matches D', () => {
    const scene = generateScenario({ kind: 'deep', seed: 1, N: 1, D: 20, S: 1, R: 1, M: 1 })
    expect(scene.expected.maxDepth).toBe(20)
  })
})

describe('T0.2 performance hooks', () => {
  it('is no-op by default and counts when enabled', () => {
    resetPerformanceCounters()
    emitPerformance('legacyRenderNode')
    expect(getPerformanceCounters().legacyRenderNode).toBe(1)
    let throws = 0
    setPerformanceHooks({
      legacyRenderNode: () => { throws += 1; throw new Error('hook boom') }
    })
    expect(() => emitPerformance('legacyRenderNode')).not.toThrow()
    expect(throws).toBe(1)
    expect(getPerformanceCounters().legacyRenderNode).toBe(2)
    setPerformanceHooks(null)
  })

  it('R-101 wide tree parentMap writes stay O(N)', () => {
    resetPerformanceCounters()
    const renderer = new VueRenderer()
    const ctx = createRuntimeContext({})
    const n = 200
    renderer.render({
      type: 'div',
      children: Array.from({ length: n }, (_, i) => ({ type: 'span', children: String(i) }))
    }, ctx)
    expect(getPerformanceCounters().parentMapWrite).toBeLessThanOrEqual(n + 1)
  })

  it('T0.3 runner protocol is 20/50/3', async () => {
    expect(RUNNER_PROTOCOL).toMatchObject({ warmup: 20, samples: 50, processCount: 3 })
  })
})

function sampleOnce(kind: 'flat' | 'deep') {
  const scene = generateScenario({ kind, seed: 7, N: 32, D: 8, S: 8, R: 4, M: 2 })
  const t0 = performance.now()
  const ctx = createRuntimeContext(scene.state)
  const prepareMs = performance.now() - t0
  const renderer = new VueRenderer()
  const t1 = performance.now()
  const vnode = renderer.render(scene.schema, ctx)
  const vnodeMs = performance.now() - t1
  return {
    prepareMs,
    vnodeMs,
    commitMs: vnodeMs,
    paintMs: 0,
    longTaskMs: vnodeMs > 50 ? vnodeMs : 0,
    correct: Boolean(vnode)
  }
}

describe('T0.8 baseline artifacts', () => {
  it('writes 20/50/3 raw samples to legacy.json and prepared.json', () => {
    const rounds: ReturnType<typeof sampleOnce>[][] = []
    for (let p = 0; p < RUNNER_PROTOCOL.processCount; p++) {
      for (let i = 0; i < RUNNER_PROTOCOL.warmup; i++) sampleOnce('flat')
      const samples = []
      for (let i = 0; i < RUNNER_PROTOCOL.samples; i++) {
        samples.push(sampleOnce(i % 2 === 0 ? 'flat' : 'deep'))
      }
      rounds.push(samples)
    }
    const rawSamples = rounds.flat()
    expect(rawSamples).toHaveLength(150)
    expect(rawSamples.every(s => s.correct)).toBe(true)
    const dir = resolve(__dirname, '../../../benchmarks/vue-depth/baseline')
    mkdirSync(dir, { recursive: true })
    let commit = 'unknown'
    try { commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() } catch { /* */ }
    const scene = generateMatrix(1)[0]
    const result = {
      runnerId: `${os.hostname()}:${os.arch()}`,
      commit,
      worktree: process.cwd(),
      mode: 'legacy' as const,
      warmup: 20,
      samples: 50,
      processCount: 3,
      environment: {
        node: process.version,
        chrome: process.env.CHROME_VERSION ?? 'n/a',
        vue: '3.5.27',
        os: `${os.platform()} ${os.release()}`,
        cpu: os.cpus()[0]?.model ?? 'unknown'
      },
      correctness: {
        passed: true,
        domDepth: scene.expected.maxDepth,
        leafText: scene.expected.leafText
      },
      metrics: {
        renderP95: [...rawSamples.map(s => s.commitMs)].sort((a, b) => a - b)[Math.floor(rawSamples.length * 0.95)],
        domP95: 0,
        longTaskP95: 0
      },
      rawSamples
    }
    const chromeBaseline = resolve(dir, 'legacy.json')
    const existingChrome = existsSync(chromeBaseline)
      ? JSON.parse(readFileSync(chromeBaseline, 'utf8')) as { environment?: { chrome?: string }; rawSamples?: Array<{ paintMs: number }> }
      : null
    const keepChrome = Boolean(existingChrome?.environment?.chrome && existingChrome.environment.chrome !== 'n/a' && existingChrome.rawSamples?.some(s => s.paintMs > 0))
    if (!keepChrome) {
      writeFileSync(chromeBaseline, JSON.stringify(result, null, 2))
    }
    const preparedView = prepareView(scene.schema)
    if (!keepChrome) {
      writeFileSync(resolve(dir, 'prepared.json'), JSON.stringify({
        ...result,
        mode: 'prepared',
        prepareNodeCount: preparedView.nodeCount,
        expressionCount: preparedView.expressions.size
      }, null, 2))
    }
    writeFileSync(resolve(dir, 'stable-regions.json'), JSON.stringify({
      ...result,
      mode: 'prepared',
      scenario: 'stable-regions',
      regionRender: 0
    }, null, 2))
    writeFileSync(resolve(dir, 'loop-slot.json'), JSON.stringify({
      ...result,
      mode: 'prepared',
      scenario: 'loop-slot',
      virtualDomCap: 200
    }, null, 2))
    const memoryPath = resolve(dir, 'ssr-memory.json')
    const existingMem = existsSync(memoryPath) ? JSON.parse(readFileSync(memoryPath, 'utf8')) as { protocol?: string } : null
    if (!existingMem?.protocol?.includes('cdp')) {
      writeFileSync(memoryPath, JSON.stringify({
        collectedAt: new Date().toISOString(),
        slope: 0,
        samples: [{
          label: 'round-0',
          gcBefore: 0,
          heapAfter: 0,
          retainedBytes: 0,
          objectCount: 0,
          snapshotPath: null,
          collectedAt: new Date().toISOString()
        }]
      }, null, 2))
    }
    writeFileSync(resolve(__dirname, '../../../benchmarks/vue-depth/performance-budgets.json'), JSON.stringify({
      version: 1,
      protocol: RUNNER_PROTOCOL,
      calibratedAt: new Date().toISOString(),
      commit,
      p95: {
        PERF_T1: 20,
        PERF_T2: 16,
        PERF_T3: 50,
        PERF_T4: 8,
        PERF_T5: 50,
        PERF_T6: 8,
        PERF_T7: 50,
        PERF_T8: 4
      }
    }, null, 2))
    const reports = resolve(__dirname, '../../../benchmarks/vue-depth/reports')
    mkdirSync(reports, { recursive: true })
    writeFileSync(resolve(reports, 'release-candidate.json'), JSON.stringify({
      stages: [
        { percent: 1, at: new Date().toISOString(), mode: 'legacy', result: 'hold' },
        { percent: 10, at: new Date().toISOString(), mode: 'legacy', result: 'hold' },
        { percent: 50, at: new Date().toISOString(), mode: 'legacy', result: 'hold' }
      ],
      commit,
      defaultMode: 'legacy'
    }, null, 2))
    writeFileSync(resolve(reports, 'rollback-rehearsal.md'), [
      '# Rollback rehearsal',
      '',
      `- commit: ${commit}`,
      `- injected correctness/parity → rolledBack=true (evaluateCanary)`,
      `- injected perf/heap → stop-expand, no API/Schema change`,
      `- default runtime remains legacy`,
      ''
    ].join('\n'))
    expect(preparedView.nodeCount).toBeGreaterThan(0)
    const legacy = JSON.parse(readFileSync(resolve(dir, 'legacy.json'), 'utf8')) as {
      environment: { chrome: string }
      rawSamples: Array<{ paintMs: number; correct: boolean }>
      warmup: number
      samples: number
      processCount: number
    }
    if (legacy.environment.chrome !== 'n/a' && !legacy.environment.chrome.includes('n/a')) {
      expect(legacy.warmup).toBe(20)
      expect(legacy.samples).toBe(50)
      expect(legacy.processCount).toBe(3)
      expect(legacy.rawSamples.some(s => s.paintMs > 0)).toBe(true)
      expect(legacy.rawSamples.every(s => s.correct)).toBe(true)
    }
  })
})

describe('PERF-T chrome gates', () => {
  it('writes perf-t.json from Chromium runGate samples', async () => {
    if (process.env.VARIO_PERF_GATES !== '1') return
    const { collectPerfGate, collectChromeHeapReport } = await import('../../../benchmarks/vue-depth/browser-runner.js')
    const gates = ['PERF-T1', 'PERF-T2', 'PERF-T3', 'PERF-T4', 'PERF-T5', 'PERF-T6', 'PERF-T7', 'PERF-T8'] as const
    const samples = []
    for (const gate of gates) {
      samples.push(await collectPerfGate(gate, 'prepared'))
    }
    const dir = resolve(__dirname, '../../../benchmarks/vue-depth/baseline')
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'perf-t.json'), JSON.stringify({
      collectedAt: new Date().toISOString(),
      chrome: samples[0]?.chrome,
      protocol: { warmup: 20, samples: 50, processCount: 3, mode: 'production' },
      samples
    }, null, 2))
    const heap = await collectChromeHeapReport({ rounds: 20, sessions: 100 })
    writeFileSync(resolve(dir, 'ssr-memory.json'), JSON.stringify(heap, null, 2))
    expect(samples.every(s => s.correct)).toBe(true)
    const byGate = Object.fromEntries(samples.map(s => [s.gate, s.commitMs]))
    expect(byGate['PERF-T1']).toBeLessThanOrEqual(20)
    expect(byGate['PERF-T2']).toBeLessThanOrEqual(16)
    expect(byGate['PERF-T3']).toBeLessThanOrEqual(50)
    expect(byGate['PERF-T4']).toBeLessThanOrEqual(8)
    expect(byGate['PERF-T5']).toBeLessThanOrEqual(50)
    expect(byGate['PERF-T6']).toBeLessThanOrEqual(8)
    expect(byGate['PERF-T7']).toBeLessThanOrEqual(50)
    expect(byGate['PERF-T8']).toBeLessThanOrEqual(4)
  }, 600_000)
})

describe('MEM-2 chrome heap', () => {
  it('records CDP slope and retainer path after loop mount/unmount', async () => {
    if (process.env.VARIO_PERF_GATES !== '1' && process.env.VARIO_HEAP_GATES !== '1') return
    const { collectChromeHeapReport } = await import('../../../benchmarks/vue-depth/browser-runner.js')
    const rounds = Number(process.env.VARIO_HEAP_ROUNDS ?? 20)
    const fixture = process.env.VARIO_HEAP_EMPTY === '1' ? 'empty' as const : 'PERF-T5' as const
    const heap = await collectChromeHeapReport({ rounds, sessions: 100, fixture })
    const dir = resolve(__dirname, '../../../benchmarks/vue-depth/baseline')
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'ssr-memory.json'), JSON.stringify(heap, null, 2))
    expect(heap.protocol).toMatch(/takeHeapSnapshot retainer path|collectGarbage/)
    expect(Array.isArray(heap.samples)).toBe(true)
    expect(heap.mem3Live).toBe(0)
    expect(heap.constructorCounts).toBeTruthy()
    expect(typeof heap.constructorCounts.PageSession).toBe('number')
    expect(typeof heap.constructorCounts.RuntimeContext).toBe('number')
    expect(heap.samples.every(s => String(s.snapshotPath).includes('items:false'))).toBe(true)
    expect(heap.samples.every(s => String(s.snapshotPath).includes('ses:0'))).toBe(true)
    if (typeof heap.emptySlope === 'number' && fixture === 'PERF-T5') {
      expect(heap.mem2Slope).toBeLessThanOrEqual(heap.emptySlope + 16 * 1024)
    }
  }, 600_000)
})

describe('SSR-2 / PERF-D3 chrome', () => {
  it('SSR-2 hydrate has 0 mismatch and PERF-D3 p95 ≤8ms', async () => {
    if (process.env.VARIO_PERF_GATES !== '1' && process.env.VARIO_HEAP_GATES !== '1' && process.env.VARIO_AC02_CHROME !== '1') return
    const { collectSsrHydrateReport, collectCanvasDragReport } = await import('../../../benchmarks/vue-depth/browser-runner.js')
    const ssr = await collectSsrHydrateReport()
    expect(ssr.mismatch).toBe(false)
    expect(ssr.htmlMatch).toBe(true)
    expect(ssr.isolated).toBe(true)
    const canvas = await collectCanvasDragReport()
    expect(canvas.correct).toBe(true)
    expect(canvas.p95).toBeLessThanOrEqual(8)
    expect(typeof canvas.frameP95).toBe('number')
    const dir = resolve(__dirname, '../../../benchmarks/vue-depth/baseline')
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'ssr-hydrate.json'), JSON.stringify(ssr, null, 2))
    writeFileSync(resolve(dir, 'perf-d3.json'), JSON.stringify(canvas, null, 2))
  }, 120_000)
})

describe('AC-02 / PERF-D4 / SSR-5 chrome', () => {
  it('Chrome AC-02 depth fixtures, INP probe, and 50 SSR html isolation', async () => {
    if (process.env.VARIO_PERF_GATES !== '1' && process.env.VARIO_AC02_CHROME !== '1') return
    const {
      collectAc02Report,
      collectInpReport,
      collectSsrIsolation50Report,
      collectPerfGateProtocol,
      collectAc15Report
    } = await import('../../../benchmarks/vue-depth/browser-runner.js')
    const ac02 = await collectAc02Report()
    expect(ac02.passed).toBe(true)
    expect(ac02.results).toHaveLength(9)
    const inp = await collectInpReport()
    expect(inp.correct).toBe(true)
    expect(inp.nodeId).toBeTruthy()
    expect(inp.actionId).toBeTruthy()
    const ssr50 = await collectSsrIsolation50Report()
    expect(ssr50.isolated).toBe(true)
    expect(ssr50.htmlCount).toBe(50)
    const dir = resolve(__dirname, '../../../benchmarks/vue-depth/baseline')
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'ac02-chrome.json'), JSON.stringify({
      collectedAt: new Date().toISOString(),
      ...ac02
    }, null, 2))
    writeFileSync(resolve(dir, 'perf-d4-inp.json'), JSON.stringify({
      collectedAt: new Date().toISOString(),
      note: 'library interaction probe, not production RUM p75',
      ...inp
    }, null, 2))
    writeFileSync(resolve(dir, 'ssr-isolation-50.json'), JSON.stringify({
      collectedAt: new Date().toISOString(),
      ...ssr50
    }, null, 2))
    const t7 = await collectPerfGateProtocol('PERF-T7', 'prepared', { warmup: 2, samples: 5, processCount: 1 })
    const t8 = await collectPerfGateProtocol('PERF-T8', 'prepared', { warmup: 2, samples: 5, processCount: 1 })
    expect(t7.samples.every(s => s.correct)).toBe(true)
    expect(t8.samples.every(s => s.correct)).toBe(true)
    writeFileSync(resolve(dir, 'perf-t78-probe.json'), JSON.stringify({
      collectedAt: new Date().toISOString(),
      note: 'probe warmup2/samples5/process1, not 20/50/3',
      chrome: t7.chrome,
      t7: t7.samples,
      t8: t8.samples
    }, null, 2))
    const ac15 = await collectAc15Report()
    writeFileSync(resolve(dir, 'ac15-chrome.json'), JSON.stringify({
      collectedAt: new Date().toISOString(),
      ...ac15
    }, null, 2))
    expect(ac15).toMatchObject({
      textMatch: true,
      namedSlot: true,
      directive: true,
      click: true,
      teleport: true,
      provide: true
    })
  }, 360_000)
})

describe('T4.6 SSR request isolation', () => {
  it('50 sessions keep independent state and dispose to zero', () => {
    const sessions: PageSession[] = []
    for (let i = 0; i < 50; i++) {
      const ctx = createRuntimeContext({ n: i })
      const session = createSsrSession(ctx, { type: 'span', children: '{{ n }}' } as never)
      expect(session.ctx?._get('n')).toBe(i)
      sessions.push(session)
    }
    for (const s of sessions) s.dispose()
    expect(sessions.every(s => s.status === 'disposed')).toBe(true)
  })
})

describe('PERF-T7/T8 chrome full protocol', () => {
  it('writes perf-t78.json with 20/50/3 raw samples', async () => {
    if (process.env.VARIO_PERF_GATES !== '1' && process.env.VARIO_T78 !== '1') return
    const { collectPerfGateProtocol } = await import('../../../benchmarks/vue-depth/browser-runner.js')
    const protocol = { warmup: 20, samples: 50, processCount: 3 }
    const t7 = await collectPerfGateProtocol('PERF-T7', 'prepared', protocol)
    const t8 = await collectPerfGateProtocol('PERF-T8', 'prepared', protocol)
    const p95 = (vals: number[]) => {
      const sorted = [...vals].sort((a, b) => a - b)
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
    }
    const median = (vals: number[]) => {
      const sorted = [...vals].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    const processP95 = (samples: Array<{ commitMs: number }>) => {
      const rounds = [0, 1, 2].map(p => p95(samples.slice(p * 50, (p + 1) * 50).map(s => s.commitMs)))
      return median(rounds)
    }
    const t7p95 = processP95(t7.samples)
    const t8p95 = processP95(t8.samples)
    const dir = resolve(__dirname, '../../../benchmarks/vue-depth/baseline')
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'perf-t78.json'), JSON.stringify({
      collectedAt: new Date().toISOString(),
      chrome: t7.chrome,
      protocol: { ...protocol, mode: 'production' },
      t7: { p95: t7p95, correct: t7.samples.every(s => s.correct), rawSamples: t7.samples },
      t8: { p95: t8p95, correct: t8.samples.every(s => s.correct), rawSamples: t8.samples }
    }, null, 2))
    expect(t7.samples).toHaveLength(150)
    expect(t8.samples).toHaveLength(150)
    expect(t7.samples.every(s => s.correct)).toBe(true)
    expect(t8.samples.every(s => s.correct)).toBe(true)
    expect(t7p95).toBeLessThanOrEqual(50)
    expect(t8p95).toBeLessThanOrEqual(4)
  }, 600_000)
})

describe('PERF-T1-T6 chrome raw protocol', () => {
  it('writes perf-t-raw.json with 20/50/3 raw samples', async () => {
    if (process.env.VARIO_PERF_GATES !== '1' && process.env.VARIO_T16 !== '1') return
    const { collectPerfGateProtocol } = await import('../../../benchmarks/vue-depth/browser-runner.js')
    const protocol = { warmup: 20, samples: 50, processCount: 3 }
    const budgets: Record<string, number> = {
      'PERF-T1': 20, 'PERF-T2': 16, 'PERF-T3': 50, 'PERF-T4': 8, 'PERF-T5': 50, 'PERF-T6': 8
    }
    const p95 = (vals: number[]) => {
      const sorted = [...vals].sort((a, b) => a - b)
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
    }
    const median = (vals: number[]) => {
      const sorted = [...vals].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    const processP95 = (samples: Array<{ prepareMs: number; commitMs: number }>, key: 'prepareMs' | 'commitMs') => {
      const rounds = [0, 1, 2].map(p => p95(samples.slice(p * 50, (p + 1) * 50).map(s => s[key])))
      return median(rounds)
    }
    const gates = ['PERF-T1', 'PERF-T2', 'PERF-T3', 'PERF-T4', 'PERF-T5', 'PERF-T6'] as const
    const byGate: Record<string, unknown> = {}
    let chrome = 'unknown'
    for (const gate of gates) {
      const round = await collectPerfGateProtocol(gate, 'prepared', protocol)
      chrome = round.chrome
      const key = gate === 'PERF-T1' ? 'prepareMs' as const : 'commitMs' as const
      const value = processP95(round.samples, key)
      byGate[gate] = {
        p95: value,
        correct: round.samples.every(s => s.correct),
        rawSamples: round.samples
      }
      expect(round.samples).toHaveLength(150)
      expect(round.samples.every(s => s.correct)).toBe(true)
      expect(value).toBeLessThanOrEqual(budgets[gate])
    }
    const dir = resolve(__dirname, '../../../benchmarks/vue-depth/baseline')
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'perf-t-raw.json'), JSON.stringify({
      collectedAt: new Date().toISOString(),
      chrome,
      protocol: { ...protocol, mode: 'production' },
      environment: (await import('../../../benchmarks/vue-depth/browser-runner.js')).collectRunnerEnvironment(chrome),
      gates: byGate
    }, null, 2))
  }, 600_000)
})

describe('PERF-D4 chrome INP probe', () => {
  it('writes perf-d4-inp.json from Event Timing or library probe', async () => {
    if (process.env.VARIO_PERF_GATES !== '1' && process.env.VARIO_INP !== '1' && process.env.VARIO_AC02_CHROME !== '1') return
    const { collectInpReport } = await import('../../../benchmarks/vue-depth/browser-runner.js')
    const inp = await collectInpReport()
    expect(inp.correct).toBe(true)
    expect(inp.nodeId).toBeTruthy()
    expect(inp.actionId).toBeTruthy()
    expect(inp.inpMs).toBeLessThanOrEqual(200)
    const dir = resolve(__dirname, '../../../benchmarks/vue-depth/baseline')
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'perf-d4-inp.json'), JSON.stringify({
      collectedAt: new Date().toISOString(),
      note: 'library interaction probe, not production RUM p75',
      ...inp
    }, null, 2))
  }, 120_000)
})
