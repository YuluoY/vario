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

import { reactive } from 'vue'
import type { ReactiveAdapter } from '@variojs/types'
import { getPathValue, setPathValue } from '@variojs/core'

/**
 * 创建 Vue 响应式适配器
 * 
 * @param state - Vue reactive() 包裹的状态对象
 * @returns ReactiveAdapter 实例
 */
export function createVueReactiveAdapter<TState extends Record<string, unknown>>(
  state: TState
): ReactiveAdapter {
  return {
    get(path: string): unknown {
      return getPathValue(state as Record<string, unknown>, path)
    },

    set(path: string, value: unknown): void {
      setPathValue(state as Record<string, unknown>, path, value, {
        createObject: () => reactive({}),
        createArray: () => reactive([]),
        createIntermediate: true
      })
    },

    getProperty(key: string): unknown {
      return (state as Record<string, unknown>)[key]
    },

    setProperty(key: string, value: unknown): void {
      (state as Record<string, unknown>)[key] = value
    },

    has(key: string): boolean {
      return key in state
    },

    keys(): string[] {
      return Object.keys(state)
    }
  }
}
