/**
 * Production browser benchmark runner (T0.3).
 * Protocol: 20 warmup + 50 samples × 3 independent Chromium processes.
 * Uses Playwright Chromium + Vite harness for real mount/paint/long-task.
 */

import { chromium } from 'playwright'
import { build, preview } from 'vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import { generateMatrix } from './fixtures.js'
import { parseHeapSnapshotRetainers, parseHeapSnapshotHolders, countHeapNodeNames, countNamedHeapNodes } from './heap-runner.js'

export const RUNNER_PROTOCOL = {
  warmup: 20,
  samples: 50,
  processCount: 3,
  modes: ['legacy', 'prepared'] as const
}

export type BenchmarkSample = {
  prepareMs: number
  vnodeMs: number
  commitMs: number
  paintMs: number
  longTaskMs: number
  longTaskCount?: number
  correct: boolean
}

export function summarizeSamples(samples: BenchmarkSample[]) {
  const sorted = (key: keyof BenchmarkSample) =>
    samples.map(s => Number(s[key]) || 0).sort((a, b) => a - b)
  const p95 = (vals: number[]) => vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.95))]
  return {
    renderP95: p95(sorted('commitMs')),
    domP95: p95(sorted('paintMs')),
    longTaskP95: p95(sorted('longTaskMs')),
    correctness: samples.every(s => s.correct)
  }
}

export type BenchmarkResult = {
  runnerId: string
  commit: string
  worktree: string
  mode: 'legacy' | 'prepared'
  warmup: 20
  samples: 50
  processCount: 3
  environment: {
    node: string
    chrome: string
    vue: string
    os: string
    cpu: string
  }
  correctness: { passed: boolean; domDepth: number; leafText: string }
  metrics: { renderP95: number; domP95: number; longTaskP95: number }
  rawSamples: BenchmarkSample[]
}

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')

export function collectRunnerEnvironment(chrome = 'unknown'): BenchmarkResult['environment'] & {
  runnerId: string
  commit: string
  worktree: string
} {
  let commit = 'unknown'
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim()
  } catch { /* */ }
  return {
    runnerId: `${os.hostname()}:${os.arch()}`,
    commit,
    worktree: repo,
    node: process.version,
    chrome,
    vue: '3.5.27',
    os: `${os.platform()} ${os.release()}`,
    cpu: os.cpus()[0]?.model ?? 'unknown'
  }
}

let harnessBuilt = false

async function ensureProductionHarness(): Promise<void> {
  if (harnessBuilt) return
  await build({
    configFile: resolve(here, 'vite.config.ts'),
    root: here,
    mode: 'production',
    logLevel: 'warn'
  })
  harnessBuilt = true
}

async function startHarnessServer(): Promise<{ close: () => Promise<void>; resolvedUrls: { local: string[] } }> {
  await ensureProductionHarness()
  const server = await preview({
    configFile: resolve(here, 'vite.config.ts'),
    preview: { port: 0, host: '127.0.0.1', strictPort: false }
  })
  const local = server.resolvedUrls?.local ?? []
  if (local.length === 0) {
    await server.close()
    throw new Error('vite preview did not bind a local URL')
  }
  return {
    resolvedUrls: { local },
    close: async () => {
      await server.close()
    }
  }
}

async function runChromeProcess(
  url: string,
  mode: 'legacy' | 'prepared'
): Promise<{ samples: BenchmarkSample[]; chrome: string }> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean((window as Window & { __varioBench?: unknown }).__varioBench))
    const samples = await page.evaluate(async ({ warmup, samples, mode }) => {
      const bench = (window as Window & {
        __varioBench: {
          runBatch: (warmup: number, samples: number, mode: 'legacy' | 'prepared') => Promise<BenchmarkSample[]>
        }
      }).__varioBench
      return bench.runBatch(warmup, samples, mode)
    }, { warmup: RUNNER_PROTOCOL.warmup, samples: RUNNER_PROTOCOL.samples, mode })
    return { samples, chrome: browser.version() }
  } finally {
    await browser.close()
  }
}

export async function runIndependentProcesses(
  processCount = RUNNER_PROTOCOL.processCount,
  mode: 'legacy' | 'prepared' = 'legacy'
): Promise<{ rounds: BenchmarkSample[][]; chrome: string }> {
  const server = await startHarnessServer()
  const address = server.resolvedUrls?.local[0]
  if (!address) {
    await server.close()
    throw new Error('vite harness did not bind a local URL')
  }
  try {
    const rounds: BenchmarkSample[][] = []
    let chrome = 'unknown'
    for (let i = 0; i < processCount; i++) {
      const result = await runChromeProcess(address, mode)
      chrome = result.chrome
      rounds.push(result.samples)
    }
    return { rounds, chrome }
  } finally {
    await server.close()
  }
}

export async function collectBenchmarkResult(options: {
  commit: string
  worktree: string
  mode?: 'legacy' | 'prepared'
}): Promise<BenchmarkResult> {
  const mode = options.mode ?? 'legacy'
  const { rounds, chrome } = await runIndependentProcesses(RUNNER_PROTOCOL.processCount, mode)
  const rawSamples = rounds.flat()
  const summary = summarizeSamples(rawSamples)
  const scene = generateMatrix(1)[0]
  return {
    runnerId: `${os.hostname()}:${os.arch()}`,
    commit: options.commit,
    worktree: options.worktree,
    mode,
    warmup: 20,
    samples: 50,
    processCount: 3,
    environment: {
      node: process.version,
      chrome,
      vue: '3.4+',
      os: `${os.platform()} ${os.release()}`,
      cpu: os.cpus()[0]?.model ?? 'unknown'
    },
    correctness: {
      passed: summary.correctness && rawSamples.length === 150,
      domDepth: scene.expected.maxDepth,
      leafText: scene.expected.leafText
    },
    metrics: {
      renderP95: summary.renderP95,
      domP95: summary.domP95,
      longTaskP95: summary.longTaskP95
    },
    rawSamples
  }
}

export async function collectPerfGate(
  gate: string,
  mode: 'legacy' | 'prepared' = 'prepared'
): Promise<BenchmarkSample & { gate: string; chrome: string }> {
  const { samples, chrome } = await collectPerfGateProtocol(gate, mode, {
    warmup: RUNNER_PROTOCOL.warmup,
    samples: RUNNER_PROTOCOL.samples,
    processCount: RUNNER_PROTOCOL.processCount
  })
  const sorted = samples.map(s => Number(gate === 'PERF-T1' ? s.prepareMs : s.commitMs)).sort((a, b) => a - b)
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(samples.length * 0.95))]
  const representative = samples[samples.length - 1]
  return {
    ...representative,
    prepareMs: gate === 'PERF-T1' ? p95 : representative.prepareMs,
    commitMs: p95,
    vnodeMs: p95,
    correct: samples.every(s => s.correct),
    gate,
    chrome
  }
}

export async function collectPerfGateProtocol(
  gate: string,
  mode: 'legacy' | 'prepared' = 'prepared',
  protocol: { warmup: number; samples: number; processCount: number } = RUNNER_PROTOCOL
): Promise<{ samples: Array<BenchmarkSample & { gate?: string }>; chrome: string }> {
  const server = await startHarnessServer()
  const address = server.resolvedUrls?.local[0]
  if (!address) {
    await server.close()
    throw new Error('vite harness did not bind a local URL')
  }
  const all: Array<BenchmarkSample & { gate?: string }> = []
  let chrome = 'unknown'
  try {
    for (let p = 0; p < protocol.processCount; p++) {
      const browser = await chromium.launch({
      headless: true,
      args: ['--js-flags=--expose-gc']
    })
      try {
        chrome = browser.version()
        const page = await browser.newPage()
        await page.goto(address, { waitUntil: 'networkidle' })
        await page.waitForFunction(() => Boolean((window as Window & { __varioBench?: unknown }).__varioBench))
        const round = await page.evaluate(async ({ gate, mode, warmup, samples }) => {
          const bench = (window as Window & {
            __varioBench: {
              runGate: (gate: string, mode: 'legacy' | 'prepared') => Promise<BenchmarkSample & { gate?: string }>
            }
          }).__varioBench
          for (let i = 0; i < warmup; i++) await bench.runGate(gate, mode)
          const out = []
          for (let i = 0; i < samples; i++) out.push(await bench.runGate(gate, mode))
          return out
        }, { gate, mode, warmup: protocol.warmup, samples: protocol.samples })
        all.push(...round)
      } finally {
        await browser.close()
      }
    }
    return { samples: all, chrome }
  } finally {
    await server.close()
  }
}

export async function collectChromeHeapReport(options: {
  rounds?: number
  sessions?: number
  fixture?: 'PERF-T5' | 'empty'
} = {}): Promise<{
  collectedAt: string
  protocol: string
  chrome: string
  slope: number
  mem2Slope: number
  emptySlope?: number
  mem3Retained: number
  mem3Live?: number
  gcAvailable?: boolean
  retainers?: string[]
  nodeNames?: Array<{ name: string; count: number }>
  samples: Array<{
    label: string
    gcBefore: number
    heapAfter: number
    retainedBytes: number
    objectCount: number
    snapshotPath: string | null
    collectedAt: string
  }>
}> {
  const rounds = options.rounds ?? 20
  const sessions = options.sessions ?? 100
  const fixture = options.fixture ?? 'PERF-T5'
  const server = await startHarnessServer()
  const address = server.resolvedUrls?.local[0]
  if (!address) {
    await server.close()
    throw new Error('vite harness did not bind a local URL')
  }
  const browser = await chromium.launch({
    headless: true,
    args: ['--js-flags=--expose-gc']
  })
  try {
    const page = await browser.newPage()
    await page.goto(address, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean((window as Window & { __varioBench?: unknown }).__varioBench))
    const cdp = await page.context().newCDPSession(page)
    const slopeOf = (rows: Array<{ heapAfter: number }>) => {
      const tail = rows.slice(Math.min(5, Math.max(0, rows.length - 10)))
      return tail.length < 2 ? 0 : (tail[tail.length - 1].heapAfter - tail[0].heapAfter) / tail.length
    }
    let emptySlope = 0
    if (fixture === 'PERF-T5') {
      const emptySamples: Array<{ heapAfter: number }> = []
      for (let i = 0; i < Math.min(10, rounds); i++) {
        await cdp.send('HeapProfiler.collectGarbage')
        await page.evaluate(() => (window as Window & { gc?: () => void }).gc?.())
        await cdp.send('HeapProfiler.collectGarbage')
        await page.evaluate(async () => {
          await (window as Window & { __varioBench: { runEmptyCycle: () => Promise<void> } }).__varioBench.runEmptyCycle()
        })
        await cdp.send('HeapProfiler.collectGarbage')
        await page.evaluate(() => (window as Window & { gc?: () => void }).gc?.())
        const after = await cdp.send('Runtime.getHeapUsage') as { usedSize: number }
        emptySamples.push({ heapAfter: after.usedSize })
      }
      emptySlope = slopeOf(emptySamples)
      await page.evaluate(() => {
        ;(window as Window & { __varioInstHistory?: WeakRef<object>[] }).__varioInstHistory = []
      })
    }
    const samples: Array<{
      label: string
      gcBefore: number
      heapAfter: number
      retainedBytes: number
      objectCount: number
      snapshotPath: string | null
      collectedAt: string
    }> = []
    for (let i = 0; i < rounds; i++) {
      await cdp.send('HeapProfiler.collectGarbage')
      await page.evaluate(() => (window as Window & { gc?: () => void }).gc?.())
      await cdp.send('HeapProfiler.collectGarbage')
      const before = await cdp.send('Runtime.getHeapUsage') as { usedSize: number }
      await page.evaluate(async ({ fixture }) => {
        const bench = (window as Window & {
          __varioBench: {
            runGate: (gate: string, mode: 'legacy' | 'prepared') => Promise<unknown>
            runEmptyCycle: () => Promise<void>
          }
        }).__varioBench
        if (fixture === 'empty') await bench.runEmptyCycle()
        else await bench.runGate('PERF-T5', 'prepared')
      }, { fixture })
      await cdp.send('HeapProfiler.collectGarbage')
      await page.evaluate(() => (window as Window & { gc?: () => void }).gc?.())
      await cdp.send('HeapProfiler.collectGarbage')
      const probe = await page.evaluate(() => {
        const leak = (window as Window & { __varioLeakProbe?: WeakRef<object> }).__varioLeakProbe
        const instance = (window as Window & { __varioAppInstance?: unknown }).__varioAppInstance
        return {
          itemsAlive: leak ? leak.deref() != null : null,
          appInstance: instance != null,
          bodySpans: document.querySelectorAll('span').length,
          bodyChildren: document.body.childElementCount,
          instAlive: (() => {
            const inst = (window as Window & { __varioInstProbe?: WeakRef<object> }).__varioInstProbe
            return inst ? inst.deref() != null : null
          })(),
          liveSessions: (window as Window & { __varioLiveSessions?: number }).__varioLiveSessions ?? null,
          liveCells: (window as Window & { __varioLiveLoopItemCells?: number }).__varioLiveLoopItemCells ?? null,
          histAlive: ((window as Window & { __varioInstHistory?: WeakRef<object>[] }).__varioInstHistory ?? [])
            .filter(ref => ref.deref() != null).length
        }
      })
      const after = await cdp.send('Runtime.getHeapUsage') as { usedSize: number }
      samples.push({
        label: `round-${i}`,
        gcBefore: before.usedSize,
        heapAfter: after.usedSize,
        retainedBytes: Math.max(0, after.usedSize - before.usedSize),
        objectCount: (probe.itemsAlive ? 1 : 0) + (probe.appInstance ? 2 : 0),
        snapshotPath: `items:${probe.itemsAlive},app:${probe.appInstance},spans:${probe.bodySpans},body:${probe.bodyChildren},inst:${probe.instAlive},ses:${probe.liveSessions},cells:${probe.liveCells},hist:${probe.histAlive}`,
        collectedAt: new Date().toISOString()
      })
    }
    const gcAvailable = await page.evaluate(() => typeof (window as Window & { gc?: () => void }).gc === 'function')
    await cdp.send('HeapProfiler.enable')
    const chunks: string[] = []
    cdp.on('HeapProfiler.addHeapSnapshotChunk', (params: { chunk: string }) => {
      chunks.push(params.chunk)
    })
    await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
    await cdp.send('HeapProfiler.disable')
    const snapshotText = chunks.join('')
    const lastProbe = samples[samples.length - 1]?.snapshotPath ?? ''
    const retainers = lastProbe.includes('items:true')
      ? parseHeapSnapshotRetainers(snapshotText, 'MEM2-UNIQUE-TOKEN')
      : parseHeapSnapshotHolders(snapshotText, 'ROOT-MEM2-MARKER').concat(
        parseHeapSnapshotRetainers(snapshotText, 'ROOT-MEM2-MARKER')
      )
    const nodeNames = countHeapNodeNames(snapshotText, 20)
    const constructorCounts = countNamedHeapNodes(snapshotText, [
      'PageSession',
      'RuntimeContext',
      'VueStateBridge',
      'RuntimeSession'
    ])
    await cdp.send('HeapProfiler.collectGarbage')
    await page.evaluate(() => (window as Window & { gc?: () => void }).gc?.())
    const beforeSessions = await cdp.send('Runtime.getHeapUsage') as { usedSize: number }
    const mem3 = await page.evaluate(async ({ sessions }) => {
      const bench = (window as Window & {
        __varioBench: { runSessionCycle: (count: number) => Promise<{ live: number }> }
      }).__varioBench
      return bench.runSessionCycle(sessions)
    }, { sessions })
    await cdp.send('HeapProfiler.collectGarbage')
    await page.evaluate(() => (window as Window & { gc?: () => void }).gc?.())
    const afterSessions = await cdp.send('Runtime.getHeapUsage') as { usedSize: number }
    void mem3
    const mem2Slope = slopeOf(samples)
    return {
      collectedAt: new Date().toISOString(),
      protocol: 'cdp HeapProfiler.collectGarbage + Runtime.getHeapUsage + expose-gc + takeHeapSnapshot retainer path',
      chrome: browser.version(),
      slope: mem2Slope,
      mem2Slope,
      emptySlope,
      mem3Retained: Math.max(0, afterSessions.usedSize - beforeSessions.usedSize),
      mem3Live: mem3.live,
      gcAvailable,
      retainers,
      nodeNames,
      constructorCounts,
      samples
    }
  } finally {
    await browser.close()
    await server.close()
  }
}

export async function collectSsrHydrateReport(): Promise<{
  mismatch: boolean
  htmlMatch: boolean
  isolated: boolean
  chrome: string
}> {
  const server = await startHarnessServer()
  const address = server.resolvedUrls?.local[0]
  if (!address) {
    await server.close()
    throw new Error('vite harness did not bind a local URL')
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(address, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean((window as Window & { __varioBench?: unknown }).__varioBench))
    const result = await page.evaluate(async () => {
      const bench = (window as Window & {
        __varioBench: { runSsrHydrate: () => Promise<{ mismatch: boolean; htmlMatch: boolean; isolated: boolean }> }
      }).__varioBench
      return bench.runSsrHydrate()
    })
    return { ...result, chrome: browser.version() }
  } finally {
    await browser.close()
    await server.close()
  }
}

export async function collectCanvasDragReport(): Promise<{ p95: number; frameP95: number; correct: boolean; chrome: string }> {
  const server = await startHarnessServer()
  const address = server.resolvedUrls?.local[0]
  if (!address) {
    await server.close()
    throw new Error('vite harness did not bind a local URL')
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(address, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean((window as Window & { __varioBench?: unknown }).__varioBench))
    const result = await page.evaluate(async () => {
      const bench = (window as Window & {
        __varioBench: { runCanvasDrag: () => Promise<{ p95: number; frameP95: number; correct: boolean }> }
      }).__varioBench
      return bench.runCanvasDrag()
    })
    return { ...result, chrome: browser.version() }
  } finally {
    await browser.close()
    await server.close()
  }
}

export async function collectAc02Report(): Promise<{
  passed: boolean
  chrome: string
  results: Array<{ d: number; kind: string; mounted: boolean; updated: boolean; unmounted: boolean }>
}> {
  const server = await startHarnessServer()
  const address = server.resolvedUrls?.local[0]
  if (!address) {
    await server.close()
    throw new Error('vite harness did not bind a local URL')
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(address, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean((window as Window & { __varioBench?: unknown }).__varioBench))
    const result = await page.evaluate(async () => {
      const bench = (window as Window & {
        __varioBench: {
          runAc02Depth: () => Promise<{
            passed: boolean
            results: Array<{ d: number; kind: string; mounted: boolean; updated: boolean; unmounted: boolean }>
          }>
        }
      }).__varioBench
      return bench.runAc02Depth()
    })
    return { ...result, chrome: browser.version() }
  } finally {
    await browser.close()
    await server.close()
  }
}

export async function collectInpReport(): Promise<{
  inpMs: number
  nodeId: string
  actionId: string
  correct: boolean
  chrome: string
}> {
  const server = await startHarnessServer()
  const address = server.resolvedUrls?.local[0]
  if (!address) {
    await server.close()
    throw new Error('vite harness did not bind a local URL')
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(address, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean((window as Window & { __varioBench?: unknown }).__varioBench))
    await page.evaluate(async () => {
      const bench = (window as Window & {
        __varioBench: { runInpMount: () => Promise<void> }
      }).__varioBench
      await bench.runInpMount()
    })
    await page.click('#vario-inp-probe')
    const result = await page.evaluate(async () => {
      const bench = (window as Window & {
        __varioBench: {
          runInpFinish: () => Promise<{
            inpMs: number
            eventTimingMs?: number
            nodeId: string
            actionId: string
            correct: boolean
            source?: string
          }>
        }
      }).__varioBench
      return bench.runInpFinish()
    })
    return { ...result, chrome: browser.version() }
  } finally {
    await browser.close()
    await server.close()
  }
}

export async function collectSsrIsolation50Report(): Promise<{
  htmlCount: number
  isolated: boolean
  chrome: string
}> {
  const server = await startHarnessServer()
  const address = server.resolvedUrls?.local[0]
  if (!address) {
    await server.close()
    throw new Error('vite harness did not bind a local URL')
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(address, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean((window as Window & { __varioBench?: unknown }).__varioBench))
    const result = await page.evaluate(async () => {
      const bench = (window as Window & {
        __varioBench: { runSsrIsolation50: () => Promise<{ htmlCount: number; isolated: boolean }> }
      }).__varioBench
      return bench.runSsrIsolation50()
    })
    return { ...result, chrome: browser.version() }
  } finally {
    await browser.close()
    await server.close()
  }
}

export async function collectAc15Report(): Promise<{
  textMatch: boolean
  namedSlot: boolean
  directive: boolean
  click: boolean
  teleport: boolean
  provide: boolean
  chrome: string
}> {
  const server = await startHarnessServer()
  const address = server.resolvedUrls?.local[0]
  if (!address) {
    await server.close()
    throw new Error('vite harness did not bind a local URL')
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(address, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean((window as Window & { __varioBench?: unknown }).__varioBench))
    const result = await page.evaluate(async () => {
      const bench = (window as Window & {
        __varioBench: {
          runAc15Parity: () => Promise<{
            textMatch: boolean
            namedSlot: boolean
            directive: boolean
            click: boolean
            teleport: boolean
            provide: boolean
          }>
        }
      }).__varioBench
      return bench.runAc15Parity()
    })
    return { ...result, chrome: browser.version() }
  } finally {
    await browser.close()
    await server.close()
  }
}
