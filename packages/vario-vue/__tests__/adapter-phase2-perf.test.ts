/**
 * 第二阶段优化性能对比：失效策略成本
 *
 * 对比目标：
 * - Phase 1（旧策略）：watch 回调中按顶层 key 全量失效
 * - Phase 2（新策略）：优先按触发路径细粒度失效，无法解析时才全量兜底
 */

import { describe, it } from 'vitest'
import { createRuntimeContext, invalidateCache } from '@variojs/core'
import type { RuntimeContext } from '@variojs/types'

interface BenchResult {
  name: string
  ops: number
  ms: number
  runs: number
}

const results: BenchResult[] = []

function bench(name: string, fn: () => void, runs = 100_000): BenchResult {
  for (let index = 0; index < 1000; index++) fn()

  const start = performance.now()
  for (let index = 0; index < runs; index++) fn()
  const ms = performance.now() - start

  const result: BenchResult = {
    name,
    ops: Math.round(runs / (ms / 1000)),
    ms: parseFloat(ms.toFixed(3)),
    runs
  }
  results.push(result)
  return result
}

function makeLargeState(topLevelKeys = 200): Record<string, unknown> {
  const state: Record<string, unknown> = {}
  for (let index = 0; index < topLevelKeys; index++) {
    state[`field${index}`] = {
      nested: {
        value: index,
        label: `label-${index}`
      }
    }
  }
  state.user = {
    profile: {
      address: {
        city: 'Shanghai',
        zip: '200000'
      }
    }
  }
  return state
}

function invalidatePhase1AllTopLevel(
  state: Record<string, unknown>,
  ctx: RuntimeContext
): void {
  for (const key in state) {
    if (key.startsWith('$') || key.startsWith('_')) continue
    invalidateCache(key, ctx)
  }
}

function invalidatePhase2ByPaths(paths: string[], ctx: RuntimeContext): void {
  for (const path of paths) {
    invalidateCache(path, ctx)
  }
}

describe('Phase2 失效策略性能对比', () => {
  it('01. 单路径变更：200顶层字段状态', () => {
    const RUNS = 120_000
    const state = makeLargeState(200)
    const ctx = createRuntimeContext(state as any) as RuntimeContext

    const r1 = bench('phase1-single-change', () => {
      invalidatePhase1AllTopLevel(state, ctx)
    }, RUNS)

    const r2 = bench('phase2-single-change', () => {
      invalidatePhase2ByPaths(['user.profile.address.city'], ctx)
    }, RUNS)

    const speedup = (r2.ops / r1.ops).toFixed(2)
    console.log('\n【单路径变更（200顶层字段）】')
    console.log(`  phase1 全量: ${r1.ms}ms / ${RUNS}次 = ${(r1.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  phase2 路径: ${r2.ms}ms / ${RUNS}次 = ${(r2.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  phase2/phase1: ${speedup}x`)
  })

  it('02. 多路径变更：同一批次20个字段', () => {
    const RUNS = 80_000
    const state = makeLargeState(200)
    const ctx = createRuntimeContext(state as any) as RuntimeContext
    const changedPaths = Array.from({ length: 20 }, (_, index) => `field${index}.nested.value`)

    const r1 = bench('phase1-batch-20', () => {
      invalidatePhase1AllTopLevel(state, ctx)
    }, RUNS)

    const r2 = bench('phase2-batch-20', () => {
      invalidatePhase2ByPaths(changedPaths, ctx)
    }, RUNS)

    const speedup = (r2.ops / r1.ops).toFixed(2)
    console.log('\n【批次20路径变更（200顶层字段）】')
    console.log(`  phase1 全量: ${r1.ms}ms / ${RUNS}次 = ${(r1.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  phase2 路径: ${r2.ms}ms / ${RUNS}次 = ${(r2.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  phase2/phase1: ${speedup}x`)
  })

  it('03. 兜底全量场景：两者应接近', () => {
    const RUNS = 80_000
    const state = makeLargeState(200)
    const ctx = createRuntimeContext(state as any) as RuntimeContext

    const r1 = bench('phase1-fallback-all', () => {
      invalidatePhase1AllTopLevel(state, ctx)
    }, RUNS)

    const r2 = bench('phase2-fallback-all', () => {
      invalidatePhase1AllTopLevel(state, ctx)
    }, RUNS)

    const ratio = (r2.ops / r1.ops).toFixed(2)
    console.log('\n【兜底全量失效】')
    console.log(`  phase1: ${r1.ms}ms / ${RUNS}次 = ${(r1.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  phase2(兜底): ${r2.ms}ms / ${RUNS}次 = ${(r2.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  phase2/phase1: ${ratio}x`)
  })

  it('04. 汇总', () => {
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║        Phase2 失效策略（路径优先）性能对比汇总                  ║')
    console.log('╠══════════════════════════════════════════════════════════════════╣')

    const groups: Record<string, BenchResult[]> = {}
    for (const result of results) {
      const prefix = result.name
        .replace(/^phase1-/, '')
        .replace(/^phase2-/, '')
      if (!groups[prefix]) groups[prefix] = []
      groups[prefix].push(result)
    }

    for (const [scenario, [left, right]] of Object.entries(groups)) {
      if (!left || !right) continue
      const phase1 = left.name.startsWith('phase1') ? left : right
      const phase2 = left.name.startsWith('phase2') ? left : right
      if (!phase1 || !phase2) continue
      const speedup = (phase2.ops / phase1.ops).toFixed(2)
      const symbol = parseFloat(speedup) >= 1 ? '🚀' : '🐢'
      console.log(`║ ${scenario.padEnd(32)} ${symbol} ${speedup}x  ║`)
    }

    console.log('╚══════════════════════════════════════════════════════════════════╝')
  })
})
