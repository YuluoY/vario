/**
 * VueReactiveAdapter
 * 
 * 将 Vue 的 reactive() 对象适配为 ReactiveAdapter 接口，
 * 让 RuntimeContext 直接读写 Vue 的响应式状态，消除"双份状态 + 三重锁同步"。
 * 
 * 设计要点：
 * - 状态只有一份（Vue reactive 对象），不再需要同步
 * - get/set 通过 @variojs/core 的 path 工具操作，支持嵌套路径
 * - createObject/createArray 使用 reactive() 确保新建结构也是响应式的
 */

import { reactive, toRaw } from 'vue'
import type { ReactiveAdapter } from '@variojs/types'
import { getPathValue, setPathValue } from '@variojs/core'

/**
 * 创建 Vue 响应式适配器
 * 
 * @param state - Vue reactive() 包裹的状态对象
 * @returns ReactiveAdapter 实例
 */
export function createVueReactiveAdapter<TState extends Record<string, unknown>>(
  state: TState,
  options: { untrackReads?: boolean } = {}
): ReactiveAdapter & { release: () => void } {
  let held: TState | null = state
  const untrackReads = options.untrackReads === true
  return {
    get(path: string): unknown {
      if (!held) return undefined
      const source = untrackReads
        ? toRaw(held) as Record<string, unknown>
        : held as Record<string, unknown>
      return getPathValue(source, path)
    },

    set(path: string, value: unknown): void {
      if (!held) return
      setPathValue(held as Record<string, unknown>, path, value, {
        createObject: () => reactive({}),
        createArray: () => reactive([]),
        createIntermediate: true
      })
    },

    getProperty(key: string): unknown {
      if (!held) return undefined
      const source = untrackReads
        ? toRaw(held) as Record<string, unknown>
        : held as Record<string, unknown>
      return source[key]
    },

    setProperty(key: string, value: unknown): void {
      if (!held) return
      (held as Record<string, unknown>)[key] = value
    },

    has(key: string): boolean {
      if (!held) return false
      const source = untrackReads
        ? toRaw(held) as Record<string, unknown>
        : held as Record<string, unknown>
      return key in source
    },

    keys(): string[] {
      if (!held) return []
      const source = untrackReads
        ? toRaw(held) as Record<string, unknown>
        : held as Record<string, unknown>
      return Object.keys(source)
    },

    release() {
      // FR-7：只断引用，不删宿主对象的 key——
      // isReactive(options.state) 时 held 就是宿主（pinia/父组件）共享的 reactive 对象
      held = null
    }
  }
}

const adapterByCtx = new WeakMap<object, { release: () => void }>()

export function bindAdapterRelease(ctx: object, adapter: { release: () => void }): void {
  adapterByCtx.set(ctx, adapter)
}

export function releaseVueAdapter(ctx: object | null | undefined): void {
  if (!ctx) return
  adapterByCtx.get(ctx)?.release()
}
