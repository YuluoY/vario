import { collectBenchmarkResult, collectPerfGate, RUNNER_PROTOCOL } from './browser-runner.js'
import { collectHeapReport } from './heap-runner.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

export async function runLockedProfile(outDir = resolve(import.meta.dirname, 'baseline')) {
  mkdirSync(outDir, { recursive: true })
  let commit = 'unknown'
  try { commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() } catch { /* */ }
  const legacy = await collectBenchmarkResult({
    commit,
    worktree: process.cwd(),
    mode: 'legacy'
  })
  const prepared = await collectBenchmarkResult({
    commit,
    worktree: process.cwd(),
    mode: 'prepared'
  })
  const heap = collectHeapReport(20)
  writeFileSync(resolve(outDir, 'legacy.json'), JSON.stringify(legacy, null, 2))
  writeFileSync(resolve(outDir, 'prepared.json'), JSON.stringify(prepared, null, 2))
  writeFileSync(resolve(outDir, 'ssr-memory.json'), JSON.stringify(heap, null, 2))
  return { protocol: RUNNER_PROTOCOL, legacy, prepared, heap }
}

const PERF_GATES = ['PERF-T1', 'PERF-T2', 'PERF-T3', 'PERF-T4', 'PERF-T5', 'PERF-T6', 'PERF-T7', 'PERF-T8'] as const

export async function runPerfGates(outDir = resolve(import.meta.dirname, 'baseline')) {
  mkdirSync(outDir, { recursive: true })
  const samples = []
  for (const gate of PERF_GATES) {
    const sample = await collectPerfGate(gate, 'prepared')
    samples.push(sample)
  }
  const report = {
    collectedAt: new Date().toISOString(),
    chrome: samples[0]?.chrome,
    samples
  }
  writeFileSync(resolve(outDir, 'perf-t.json'), JSON.stringify(report, null, 2))
  return report
}

const invoked = process.argv[1]?.includes('run-profile')
if (invoked && process.argv.includes('--gates')) {
  runPerfGates().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
