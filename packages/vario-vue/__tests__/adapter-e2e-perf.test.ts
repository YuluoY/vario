/**
 * useVario 端到端性能对比（更新 -> 失效 -> 调度 -> 渲染）
 *
 * 说明：
 * - phase1-sim: 第一阶段策略模拟（watch 顶层全量失效）
 * - phase2: 当前 useVario 实现（路径优先失效 + 全量兜底）
 */

import { describe, it } from 'vitest'
import {
  reactive,
  watch,
  nextTick,
  computed,
  effectScope,
  type EffectScope
} from 'vue'
import { createRuntimeContext, invalidateCache } from '@variojs/core'
import type { RuntimeContext } from '@variojs/types'
import type { Schema } from '@variojs/schema'
import { useVario } from '../src/composable.js'
import { VueRenderer } from '../src/renderer.js'
import { createVueReactiveAdapter } from '../src/adapter.js'

interface AsyncBenchResult {
  name: string
  ops: number
  ms: number
  runs: number
}

const results: AsyncBenchResult[] = []

async function benchAsync(name: string, fn: () => Promise<void>, runs = 300): Promise<AsyncBenchResult> {
  for (let index = 0; index < 10; index++) {
    await fn()
  }

  const start = performance.now()
  for (let index = 0; index < runs; index++) {
    await fn()
  }
  const ms = performance.now() - start

  const result: AsyncBenchResult = {
    name,
    ops: Math.round(runs / (ms / 1000)),
    ms: parseFloat(ms.toFixed(3)),
    runs
  }
  results.push(result)
  return result
}

function makeState(): Record<string, unknown> {
  const state: Record<string, unknown> = {
    user: {
      profile: {
        address: {
          city: 'Shanghai',
          zip: '200000'
        },
        displayName: 'Alice'
      }
    },
    form: {
      section1: {
        name: 'Alice',
        age: 18,
        email: 'alice@example.com'
      },
      section2: {
        company: 'Vario',
        title: 'Engineer'
      }
    }
  }

  for (let index = 0; index < 80; index++) {
    state[`field${index}`] = {
      nested: {
        value: index,
        label: `label-${index}`
      }
    }
  }

  return state
}

function makeSchema(): Schema<Record<string, unknown>> {
  const children = [
    { type: 'div', children: 'name: {{ form.section1.name }}' },
    { type: 'div', children: 'city: {{ user.profile.address.city }}' },
    { type: 'div', children: 'company: {{ form.section2.company }}' }
  ] as Array<Record<string, unknown>>

  for (let index = 0; index < 80; index++) {
    children.push({
      type: 'div',
      children: `v${index}: {{ field${index}.nested.value }}`
    })
  }

  return {
    type: 'div',
    children
  } as Schema<Record<string, unknown>>
}

function cloneState<T>(state: T): T {
  return JSON.parse(JSON.stringify(state)) as T
}

interface Runner {
  updateByCtxSet: (path: string, value: unknown) => Promise<void>
  updateByDirectWrite: () => Promise<void>
  dispose: () => void
}

function createPhase1SimRunner(schema: Schema<Record<string, unknown>>, initialState: Record<string, unknown>): Runner {
  let nameSeed = 0
  const scope = effectScope()
  let stopWatch: (() => void) | null = null
  let ctx!: RuntimeContext<Record<string, unknown>>
  let reactiveState!: Record<string, unknown>

  scope.run(() => {
    reactiveState = reactive(cloneState(initialState))

    const adapter = createVueReactiveAdapter(reactiveState)
    const renderer = new VueRenderer({
      getState: () => reactiveState
    })

    let skipReactiveWatchOnce = false
    let renderScheduled = false
    let isRendering = false

    const scheduleRender = () => {
      if (renderScheduled || isRendering) return
      renderScheduled = true
      nextTick(() => {
        renderScheduled = false
        isRendering = true
        try {
          renderer.render(schema as any, ctx as RuntimeContext)
        } finally {
          isRendering = false
        }
      })
    }

    ctx = createRuntimeContext<Record<string, unknown>>({}, {
      adapter,
      onStateChange: (path, _value, runtimeCtx) => {
        invalidateCache(path, runtimeCtx as RuntimeContext)
        skipReactiveWatchOnce = true
        scheduleRender()
      }
    })

    stopWatch = watch(reactiveState as object, () => {
      if (skipReactiveWatchOnce) {
        skipReactiveWatchOnce = false
        return
      }

      // 第一阶段策略：顶层全量失效
      for (const key in reactiveState) {
        if (key.startsWith('$') || key.startsWith('_')) continue
        invalidateCache(key, ctx as RuntimeContext)
      }
      scheduleRender()
    }, { deep: true, flush: 'sync' })

    scheduleRender()
  })

  const updateByCtxSet = async (path: string, value: unknown): Promise<void> => {
    ctx._set(path as any, value as any)
    await nextTick()
  }

  const updateByDirectWrite = async (): Promise<void> => {
    nameSeed++
    ;(reactiveState.form as any).section1.name = `phase1-${nameSeed}`
    await nextTick()
  }

  const dispose = (): void => {
    stopWatch?.()
    scope.stop()
  }

  return {
    updateByCtxSet,
    updateByDirectWrite,
    dispose
  }
}

function createPhase2UseVarioRunner(schema: Schema<Record<string, unknown>>, initialState: Record<string, unknown>): Runner {
  let nameSeed = 0
  const scope: EffectScope = effectScope()
  let ctxRef!: { value: RuntimeContext<Record<string, unknown>> }
  let stateRef!: Record<string, unknown>

  scope.run(() => {
    const result = useVario<Record<string, unknown>>(computed(() => schema), {
      state: reactive(cloneState(initialState))
    })
    ctxRef = result.ctx
    stateRef = result.state
  })

  const updateByCtxSet = async (path: string, value: unknown): Promise<void> => {
    ctxRef.value._set(path as any, value as any)
    await nextTick()
  }

  const updateByDirectWrite = async (): Promise<void> => {
    nameSeed++
    ;(stateRef.form as any).section1.name = `phase2-${nameSeed}`
    await nextTick()
  }

  const dispose = (): void => {
    scope.stop()
  }

  return {
    updateByCtxSet,
    updateByDirectWrite,
    dispose
  }
}

describe('useVario E2E 性能对比（phase1-sim vs phase2）', () => {
  it('01. ctx._set 深路径更新（含渲染调度）', async () => {
    const RUNS = 300
    const schema = makeSchema()
    const baseState = makeState()

    const runner1 = createPhase1SimRunner(schema, baseState)
    const runner2 = createPhase2UseVarioRunner(schema, baseState)

    try {
      const r1 = await benchAsync('phase1-e2e-ctxset-deep', async () => {
        await runner1.updateByCtxSet('user.profile.address.city', 'Beijing')
      }, RUNS)

      const r2 = await benchAsync('phase2-e2e-ctxset-deep', async () => {
        await runner2.updateByCtxSet('user.profile.address.city', 'Beijing')
      }, RUNS)

      const speedup = (r2.ops / r1.ops).toFixed(2)
      console.log('\n【E2E ctx._set 深路径更新】')
      console.log(`  phase1-sim: ${r1.ms}ms / ${RUNS}次 = ${r1.ops} ops/s`)
      console.log(`  phase2:     ${r2.ms}ms / ${RUNS}次 = ${r2.ops} ops/s`)
      console.log(`  phase2/phase1: ${speedup}x`)
    } finally {
      runner1.dispose()
      runner2.dispose()
    }
  })

  it('02. 外部直接写 reactiveState（含渲染调度）', async () => {
    const RUNS = 300
    const schema = makeSchema()
    const baseState = makeState()

    const runner1 = createPhase1SimRunner(schema, baseState)
    const runner2 = createPhase2UseVarioRunner(schema, baseState)

    try {
      const r1 = await benchAsync('phase1-e2e-directwrite', async () => {
        await runner1.updateByDirectWrite()
      }, RUNS)

      const r2 = await benchAsync('phase2-e2e-directwrite', async () => {
        await runner2.updateByDirectWrite()
      }, RUNS)

      const speedup = (r2.ops / r1.ops).toFixed(2)
      console.log('\n【E2E 外部直接写 state】')
      console.log(`  phase1-sim: ${r1.ms}ms / ${RUNS}次 = ${r1.ops} ops/s`)
      console.log(`  phase2:     ${r2.ms}ms / ${RUNS}次 = ${r2.ops} ops/s`)
      console.log(`  phase2/phase1: ${speedup}x`)
    } finally {
      runner1.dispose()
      runner2.dispose()
    }
  })

  it('03. 汇总', () => {
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║           useVario E2E 性能对比（phase1-sim vs phase2）         ║')
    console.log('╠══════════════════════════════════════════════════════════════════╣')

    const groups: Record<string, AsyncBenchResult[]> = {}
    for (const result of results) {
      const key = result.name
        .replace(/^phase1-/, '')
        .replace(/^phase2-/, '')
      if (!groups[key]) groups[key] = []
      groups[key].push(result)
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
