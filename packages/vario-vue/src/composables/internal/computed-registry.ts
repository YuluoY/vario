import { computed, watch, isRef, type ComputedRef } from 'vue'
import { invalidateCache, recordChange } from '@variojs/core'
import type { RuntimeContext } from '@variojs/types'
import { isDeepEqual } from './composable-helpers.js'

/**
 * 注册 computed 到运行时上下文
 *
 * - 支持两种输入：函数式定义 / 已有 ComputedRef
 * - computed 值变化时失效表达式缓存并记录变更（驱动视图更新）
 * - 在 reactiveState 上定义只读 getter，便于模板直读
 */
export function registerComputed<TState extends Record<string, unknown>>(
  computedDefs: Record<string, ((state: TState) => any) | ComputedRef<any>>,
  reactiveState: TState,
  ctx: RuntimeContext<TState>
): void {
  Object.entries(computedDefs).forEach(([key, def]) => {
    let cVal: ComputedRef<any>

    // 支持 Composition 风格（直接传 ComputedRef）
    if (isRef(def)) {
      cVal = def as ComputedRef<any>
    } else {
      // Options 风格：传入 (state) => value
      const fn = def as (state: TState) => any
      cVal = computed(() => fn(reactiveState))
    }

    // 上次同步的值：与 cVal 新值比较决定是否需要失效。
    // 不能用 ctx._get(key) 作比较基准——reactiveState 上该键是透传 cVal.value 的
    // getter，读到的永远是最新值，与 watch 的新值恒相等会导致变更被永远跳过，
    // 表达式缓存全部冻结（视图不更新）。
    // 另外不能用 _set 回写：getter-only 属性的 proxy set 会抛 TypeError；
    // 读取永远走 getter 拿最新值，这里只需失效缓存 + 记录变更。
    // flush 必须是 'sync'：深度 state watch（同为 sync）在突变时同步调度渲染微任务，
    // 若本 watch 走默认 'pre'（flushJobs 队列），渲染微任务可能先于队列执行——
    // 渲染命中未失效的 computed 表达式缓存（如结算徽标冻结在旧值），失效发生在渲染后且无人再渲染。
    let lastSynced: unknown
    watch(cVal, (val) => {
      if (isDeepEqual(lastSynced, val)) {
        return
      }
      lastSynced = val
      invalidateCache(key, ctx as RuntimeContext<Record<string, unknown>>)
      recordChange(ctx, key, val)
    }, { immediate: true, flush: 'sync' })

    // 将 computed 透出到 state 上（只读）
    Object.defineProperty(reactiveState, key, {
      get: () => cVal.value,
      enumerable: true,
      configurable: true
    })
  })
}
