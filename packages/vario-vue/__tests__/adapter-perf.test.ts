/**
 * ReactiveAdapter 性能对比测试
 *
 * 目标：量化 adapter 模式相比旧式"双份状态 + 三重锁"在各热路径上的实际差异。
 *
 * 对比方式：
 * - "旧式"：createRuntimeContext(initialState)，不传 adapter（backward-compat 路径）
 *   + 手动模拟旧 onStateChange（setPathValue → reactive）
 *   + 手动模拟旧 watch callback（syncStateToContext with deep equal）
 * - "adapter"：createRuntimeContext({}, { adapter })，使用 createVueReactiveAdapter
 *
 * 测试场景：
 * 1. 初始化成本（大状态对象）
 * 2. 单次 _set 热路径
 * 3. 单次 _get 热路径
 * 4. 批量写（1000 次 _set，模拟 Action VM 密集执行）
 * 5. 混合读写（模拟表单填写：50字段各读写一次）
 * 6. 嵌套路径写（深度路径 'a.b.c.d'）
 */

import { describe, it } from 'vitest'
import { reactive } from 'vue'
import { createRuntimeContext, setPathValue, invalidateCache } from '@variojs/core'
import { createVueReactiveAdapter } from '../src/adapter.js'
import type { RuntimeContext } from '@variojs/types'

// ============================================================================
// 基准测试工具
// ============================================================================

interface BenchResult {
  name: string
  ops: number      // 每秒操作次数
  ms: number       // 总耗时
  runs: number
}

const results: BenchResult[] = []

function bench(name: string, fn: () => void, runs = 100_000): BenchResult {
  // 预热（JIT 编译稳定）
  for (let i = 0; i < 1000; i++) fn()

  const start = performance.now()
  for (let i = 0; i < runs; i++) fn()
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

// ============================================================================
// 旧式同步模拟（精确还原三重锁逻辑）
// ============================================================================

function createLegacyContext<T extends Record<string, unknown>>(
  initialState: T
): { ctx: RuntimeContext<T>; reactiveState: T } {
  const reactiveState = reactive(initialState) as T
  let syncing = false
  const syncingPaths = new Set<string>()

  const ctx = createRuntimeContext<T>(initialState as T, {
    onStateChange: (path, value, runtimeCtx) => {
      if (syncing) return
      if (syncingPaths.has(path)) return
      syncing = true
      syncingPaths.add(path)
      try {
        setPathValue(reactiveState as Record<string, unknown>, path, value, {
          createObject: () => reactive({}),
          createArray: () => reactive([]),
          createIntermediate: true
        })
        invalidateCache(path, runtimeCtx as RuntimeContext)
      } finally {
        syncingPaths.delete(path)
        syncing = false
      }
    }
  })

  // 模拟旧式 watch(reactive) → syncStateToContext
  // （测试中不实际启动 Vue watch，但初始拷贝循环要做）
  for (const key in reactiveState) {
    if (key.startsWith('$') || key.startsWith('_')) continue
    const value = (reactiveState as Record<string, unknown>)[key]
    ctx._set(key as any, value as any, { skipCallback: true })
  }

  return { ctx, reactiveState }
}

function createAdapterContext<T extends Record<string, unknown>>(
  initialState: T
): { ctx: RuntimeContext<T>; reactiveState: T } {
  const reactiveState = reactive(initialState) as T
  const adapter = createVueReactiveAdapter<T>(reactiveState)
  const ctx = createRuntimeContext<T>({} as T, {
    adapter,
    onStateChange: (path, _value, runtimeCtx) => {
      invalidateCache(path, runtimeCtx as RuntimeContext)
    }
  })
  return { ctx, reactiveState }
}

// ============================================================================
// 测试数据
// ============================================================================

function makeSmallState() {
  return { count: 0, name: 'Alice', active: true }
}

function makeMediumState() {
  const state: Record<string, unknown> = {}
  for (let i = 0; i < 50; i++) {
    state[`field${i}`] = i % 2 === 0 ? `value${i}` : i
  }
  return state
}

function makeLargeState() {
  const state: Record<string, unknown> = {}
  for (let i = 0; i < 200; i++) {
    state[`field${i}`] = `value${i}`
  }
  return state
}

function makeNestedState() {
  return {
    user: { profile: { address: { city: 'Shanghai' } } },
    settings: { theme: { color: { primary: '#409EFF' } } }
  }
}

// ============================================================================
// 测试套件
// ============================================================================

describe('ReactiveAdapter 性能对比', () => {

  // ─── 1. 初始化成本 ────────────────────────────────────────────────────────
  it('01. 初始化成本：50字段状态', () => {
    const RUNS = 10_000

    const r1 = bench('legacy-init-50fields', () => {
      createLegacyContext(makeMediumState() as any)
    }, RUNS)

    const r2 = bench('adapter-init-50fields', () => {
      createAdapterContext(makeMediumState() as any)
    }, RUNS)

    const speedup = (r2.ops / r1.ops).toFixed(2)
    console.log(`\n【初始化 50字段状态】`)
    console.log(`  旧式:    ${r1.ms}ms / ${RUNS}次 = ${(r1.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  adapter: ${r2.ms}ms / ${RUNS}次 = ${(r2.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  加速:    ${speedup}x`)
  })

  it('02. 初始化成本：200字段状态', () => {
    const RUNS = 5_000

    const r1 = bench('legacy-init-200fields', () => {
      createLegacyContext(makeLargeState() as any)
    }, RUNS)

    const r2 = bench('adapter-init-200fields', () => {
      createAdapterContext(makeLargeState() as any)
    }, RUNS)

    const speedup = (r2.ops / r1.ops).toFixed(2)
    console.log(`\n【初始化 200字段状态】`)
    console.log(`  旧式:    ${r1.ms}ms / ${RUNS}次 = ${(r1.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  adapter: ${r2.ms}ms / ${RUNS}次 = ${(r2.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  加速:    ${speedup}x`)
  })

  // ─── 2. 单次 _set 热路径 ──────────────────────────────────────────────────
  it('03. 单次 _set：浅路径 ("count")', () => {
    const RUNS = 200_000

    const { ctx: legacyCtx } = createLegacyContext(makeSmallState())
    const { ctx: adapterCtx } = createAdapterContext(makeSmallState())

    let i = 0
    const r1 = bench('legacy-set-shallow', () => {
      legacyCtx._set('count' as any, i++ as any)
    }, RUNS)

    i = 0
    const r2 = bench('adapter-set-shallow', () => {
      adapterCtx._set('count' as any, i++ as any)
    }, RUNS)

    const ratio = (r1.ops / r2.ops).toFixed(2)
    console.log(`\n【单次 _set 浅路径 "count"】`)
    console.log(`  旧式:    ${r1.ms}ms = ${(r1.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  adapter: ${r2.ms}ms = ${(r2.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  旧/新:   ${ratio}x (旧式更快？因为 plain object set vs reactive set)`)
  })

  it('04. 单次 _set：嵌套路径 ("user.profile.address.city")', () => {
    const RUNS = 100_000

    const { ctx: legacyCtx } = createLegacyContext(makeNestedState() as any)
    const { ctx: adapterCtx } = createAdapterContext(makeNestedState() as any)

    const r1 = bench('legacy-set-nested', () => {
      legacyCtx._set('user.profile.address.city' as any, 'Beijing' as any)
    }, RUNS)

    const r2 = bench('adapter-set-nested', () => {
      adapterCtx._set('user.profile.address.city' as any, 'Beijing' as any)
    }, RUNS)

    const speedup = (r2.ops / r1.ops).toFixed(2)
    console.log(`\n【单次 _set 嵌套路径 "user.profile.address.city"】`)
    console.log(`  旧式:    ${r1.ms}ms = ${(r1.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  adapter: ${r2.ms}ms = ${(r2.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  adapter/旧: ${speedup}x`)
    console.log(`  注：旧式嵌套 _set 要写两次完整路径（ctx + reactive），adapter 只写一次`)
  })

  // ─── 3. 单次 _get 热路径 ──────────────────────────────────────────────────
  it('05. 单次 _get：浅路径 ("count")', () => {
    const RUNS = 200_000

    const { ctx: legacyCtx } = createLegacyContext(makeSmallState())
    const { ctx: adapterCtx } = createAdapterContext(makeSmallState())

    const r1 = bench('legacy-get-shallow', () => {
      legacyCtx._get('count' as any)
    }, RUNS)

    const r2 = bench('adapter-get-shallow', () => {
      adapterCtx._get('count' as any)
    }, RUNS)

    const ratio = (r1.ops / r2.ops).toFixed(2)
    console.log(`\n【单次 _get 浅路径 "count"】`)
    console.log(`  旧式:    ${r1.ms}ms = ${(r1.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  adapter: ${r2.ms}ms = ${(r2.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  旧/新:   ${ratio}x`)
  })

  // ─── 4. Action VM 密集写场景 ──────────────────────────────────────────────
  it('06. 批量写（1000次 _set，模拟 Action VM）', () => {
    const BATCH = 1000
    const RUNS = 500

    const { ctx: legacyCtx } = createLegacyContext(makeSmallState())
    const { ctx: adapterCtx } = createAdapterContext(makeSmallState())

    const r1 = bench('legacy-batch-set-1000', () => {
      for (let i = 0; i < BATCH; i++) {
        legacyCtx._set('count' as any, i as any)
      }
    }, RUNS)

    const r2 = bench('adapter-batch-set-1000', () => {
      for (let i = 0; i < BATCH; i++) {
        adapterCtx._set('count' as any, i as any)
      }
    }, RUNS)

    const speedup = (r2.ops / r1.ops).toFixed(2)
    console.log(`\n【批量写 1000次 _set（Action VM 场景）】`)
    console.log(`  旧式:    ${r1.ms}ms / ${RUNS}批 = ${r1.ms / RUNS}ms/批`)
    console.log(`  adapter: ${r2.ms}ms / ${RUNS}批 = ${r2.ms / RUNS}ms/批`)
    console.log(`  adapter/旧: ${speedup}x`)
  })

  // ─── 5. 混合读写（模拟表单填写） ─────────────────────────────────────────
  it('07. 混合读写（50字段各读写一次，模拟表单 onChange）', () => {
    const RUNS = 10_000
    const state = makeMediumState()
    const keys = Object.keys(state)

    const { ctx: legacyCtx } = createLegacyContext(state as any)
    const { ctx: adapterCtx } = createAdapterContext(state as any)

    const r1 = bench('legacy-form-rw', () => {
      for (const key of keys) {
        const v = legacyCtx._get(key as any)
        legacyCtx._set(key as any, v as any)
      }
    }, RUNS)

    const r2 = bench('adapter-form-rw', () => {
      for (const key of keys) {
        const v = adapterCtx._get(key as any)
        adapterCtx._set(key as any, v as any)
      }
    }, RUNS)

    const speedup = (r2.ops / r1.ops).toFixed(2)
    console.log(`\n【混合读写 50字段（表单场景）】`)
    console.log(`  旧式:    ${r1.ms}ms / ${RUNS}次 = ${(r1.ms / RUNS * 1000).toFixed(2)}μs/次`)
    console.log(`  adapter: ${r2.ms}ms / ${RUNS}次 = ${(r2.ms / RUNS * 1000).toFixed(2)}μs/次`)
    console.log(`  adapter/旧: ${speedup}x`)
  })

  // ─── 6. onStateChange 路径（旧式 vs adapter 的核心差异） ─────────────────
  it('08. onStateChange 路径成本（隔离对比：仅衡量同步开销本身）', () => {
    const RUNS = 100_000

    // 旧式 onStateChange 做的事：setPathValue + invalidateCache（此处精简测量）
    const reactiveState1 = reactive({ x: 0 })
    const fakeCtx1 = createRuntimeContext({ x: 0 })
    const r1 = bench('legacy-onStateChange-path', () => {
      setPathValue(reactiveState1, 'x', 1, {
        createObject: () => reactive({}),
        createArray: () => reactive([]),
        createIntermediate: true
      })
      invalidateCache('x', fakeCtx1 as RuntimeContext)
    }, RUNS)

    // adapter onStateChange 做的事：仅 invalidateCache
    const fakeCtx2 = createRuntimeContext({ x: 0 })
    const r2 = bench('adapter-onStateChange-path', () => {
      invalidateCache('x', fakeCtx2 as RuntimeContext)
    }, RUNS)

    const speedup = (r2.ops / r1.ops).toFixed(2)
    console.log(`\n【onStateChange 路径成本隔离对比】`)
    console.log(`  旧式 (setPathValue + invalidateCache): ${r1.ms}ms = ${(r1.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  adapter (仅 invalidateCache):           ${r2.ms}ms = ${(r2.ops / 1000).toFixed(0)}k ops/s`)
    console.log(`  adapter/旧: ${speedup}x (每次 _set 节省的同步成本)`)
  })

  // ─── 7. 内存：状态副本数量 ────────────────────────────────────────────────
  it('09. 内存对比（大状态对象的属性存储量）', () => {
    const largeState = makeLargeState()
    const fieldCount = Object.keys(largeState).length

    // 旧式：ctx 对象 + reactive 各存一份
    const { ctx: legacyCtx, reactiveState: legacyReactive } = createLegacyContext(largeState as any)
    const legacyCtxKeys = Object.keys(legacyCtx).filter(k => !k.startsWith('$') && !k.startsWith('_'))
    const legacyReactiveKeys = Object.keys(legacyReactive)

    // adapter：只有 reactive 存一份
    const { ctx: adapterCtx, reactiveState: adapterReactive } = createAdapterContext(largeState as any)
    const adapterCtxKeys = Object.keys(adapterCtx).filter(k => !k.startsWith('$') && !k.startsWith('_'))
    const adapterReactiveKeys = Object.keys(adapterReactive)

    console.log(`\n【内存：状态属性存储数量（${fieldCount} 字段状态）】`)
    console.log(`  旧式：ctx 内 ${legacyCtxKeys.length} 个状态属性 + reactive 内 ${legacyReactiveKeys.length} 个 = ${legacyCtxKeys.length + legacyReactiveKeys.length} 份`)
    console.log(`  adapter：ctx 内 ${adapterCtxKeys.length} 个状态属性（通过 adapter 路由）+ reactive 内 ${adapterReactiveKeys.length} 个 = ${adapterCtxKeys.length + adapterReactiveKeys.length} 份`)
    console.log(`  节省：减少 ${legacyCtxKeys.length} 个属性的冗余拷贝（${((legacyCtxKeys.length / (legacyCtxKeys.length + legacyReactiveKeys.length)) * 100).toFixed(0)}% 内存节省）`)
  })

  // ─── 最终汇总 ─────────────────────────────────────────────────────────────
  it('10. 性能对比汇总', () => {
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║              ReactiveAdapter 重构性能对比汇总                    ║')
    console.log('╠══════════════════════════════════════════════════════════════════╣')

    const groups: Record<string, BenchResult[]> = {}
    for (const r of results) {
      const prefix = r.name.split('-').slice(0, -1).join('-')
        .replace(/^(legacy|adapter)-/, '')
      if (!groups[prefix]) groups[prefix] = []
      groups[prefix].push(r)
    }

    for (const [scenario, [r1, r2]] of Object.entries(groups)) {
      if (!r1 || !r2) continue
      const legacyR = r1.name.startsWith('legacy') ? r1 : r2
      const adapterR = r1.name.startsWith('adapter') ? r1 : r2
      if (!legacyR || !adapterR) continue
      const speedup = (adapterR.ops / legacyR.ops).toFixed(2)
      const symbol = parseFloat(speedup) >= 1 ? '🚀' : '🐢'
      console.log(`║ ${scenario.padEnd(32)} ${symbol} ${speedup}x  ║`)
    }

    console.log('╚══════════════════════════════════════════════════════════════════╝')
  })
})
