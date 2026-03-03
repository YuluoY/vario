import { computed, watch, type ComputedRef } from 'vue'
import type { RuntimeContext } from '@variojs/types'
import { isDeepEqual } from './composable-helpers.js'

/**
 * 注册 computed 到运行时上下文
 *
 * 行为保持与原实现一致：
 * - 支持两种输入：函数式定义 / 已有 ComputedRef
 * - 通过 watch 将 computed 值同步到 ctx（避免表达式/动作读取不到最新值）
 * - 使用深度比较减少无效 _set
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
    if (def && typeof def === 'object' && 'value' in def && 'effect' in def) {
      cVal = def as ComputedRef<any>
    } else {
      // Options 风格：传入 (state) => value
      const fn = def as (state: TState) => any
      cVal = computed(() => fn(reactiveState))
    }

    watch(cVal, (val) => {
      const currentValue = ctx._get(key as any)
      if (!isDeepEqual(currentValue, val)) {
        ctx._set(key as any, val as any, { skipCallback: true })
      }
    }, { immediate: true })

    // 将 computed 透出到 state 上（只读）
    Object.defineProperty(reactiveState, key, {
      get: () => cVal.value,
      enumerable: true,
      configurable: true
    })
  })
}
