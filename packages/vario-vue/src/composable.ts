/**
 * useVario composable for Vue integration
 *
 * 设计目标：
 * - Options 风格（state/computed/methods）零学习成本
 * - Composition 风格透传 reactive/computed
 * - 状态直接可访问（无需 .value）
 * - 方法统一通过 $methods 调用
 * - 生命周期：在使用 useVario 的组件中直接使用 Vue 的生命周期钩子
 *   （如 onMounted, onUnmounted 等），无需通过 options 传递
 *
 * 性能优化：
 * - 1000+ 组件场景：避免在每个 useVario 中注册生命周期钩子
 * - 生命周期钩子应在使用 useVario 的组件中直接使用，减少抽象层开销
 */

import {
  ref,
  toRaw,
  getCurrentInstance,
  type Ref,
  type VNode,
  type ComputedRef
} from 'vue'
import type { Schema } from '@variojs/schema'
import type { RuntimeContext } from '@variojs/types'
import { createSchemaAnalyzer } from './features/schema-analyzer.js'
import { useSchemaQuery } from './composables/useSchemaQuery.js'
import {
  resolveSchema,
} from './composables/internal/composable-helpers.js'
import { registerComputed } from './composables/internal/computed-registry.js'
import { createInvalidationController } from './composables/internal/invalidation-controller.js'
import {
  initStateAndMethods,
  createRenderScheduler,
  initRuntimeContext,
  initRenderer,
  createRenderWithErrorBoundary,
  setupWatchers
} from './composables/internal/use-vario-phases.js'
import type {
  MethodContext,
  UseVarioOptions,
  UseVarioResult,
  UseVarioOverload
} from './types.js'

export type {
  MethodContext,
  UseVarioOptions,
  UseVarioResult,
  UseVarioOverload
} from './types.js'

/**
 * 定义带类型推导的方法处理函数
 * 
 * @template TEvent - 事件值类型
 * @template TState - 状态类型
 * @param handler - 方法处理函数
 * @returns 原函数（仅用于类型推导）
 * 
 * @example
 * ```typescript
 * const { } = useVario(schema, {
 *   methods: {
 *     // value 自动推导为 string[]
 *     onCollapseChange: defineMethod<string[]>(({ value }) => {
 *       activeNames.value = value
 *     }),
 *     
 *     // value 自动推导为 MouseEvent
 *     onClick: defineMethod<MouseEvent>(({ value }) => {
 *       console.log(value.clientX, value.clientY)
 *     }),
 *     
 *     // 同时访问 state 和 value
 *     onSubmit: defineMethod<FormData>(({ value, state }) => {
 *       state.formData = value
 *     })
 *   }
 * })
 * ```
 */
export function defineMethod<TEvent = unknown, TState extends Record<string, unknown> = Record<string, unknown>>(
  handler: (ctx: MethodContext<TState, TEvent>) => any
): (ctx: MethodContext<TState, any>) => any {
  return handler
}


// 实现：使用箭头函数
export const useVario: UseVarioOverload = <TState extends Record<string, unknown>>(
  schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>,
  options: UseVarioOptions<TState> = {}
): UseVarioResult<TState> => {
  const schemaRef = resolveSchema(schema)

  // Phase 1: Schema 分析器
  const analyzer = createSchemaAnalyzer(schemaRef, { lazy: true })
  const instance = getCurrentInstance()

  // Phase 2: State & Methods
  const { reactiveState, methodsRegistry } = initStateAndMethods(options)

  // Phase 3: Render 调度器
  const scheduler = createRenderScheduler()

  // Phase 4: Invalidation 控制器
  const invalidationController = createInvalidationController(reactiveState, toRaw)

  // Phase 5: Runtime Context
  const ctx = initRuntimeContext(reactiveState, methodsRegistry, invalidationController, scheduler, options)

  // Phase 6: Computed 属性
  if (options.computed) {
    registerComputed(options.computed, reactiveState, ctx)
  }

  const ctxRef = ref(ctx) as Ref<RuntimeContext<TState>>

  // Phase 7: Renderer
  const { renderer, refsRegistry } = initRenderer(instance, options, reactiveState)

  // Phase 8: Query API
  const queryApi = useSchemaQuery(schemaRef, analyzer, {
    patchNode: (path, patch) => renderer.patchSchemaNode(path, patch)
  })

  // Phase 9: Render（含 Error Boundary）
  const vnodeRef = ref<VNode | null>(null)
  const errorRef = ref<Error | null>(null)
  const render = createRenderWithErrorBoundary(schemaRef, renderer, ctx as RuntimeContext, vnodeRef, errorRef, options)

  scheduler.setRenderFn(render)
  render()

  // Phase 10: Reactive Watchers
  setupWatchers(schemaRef, reactiveState, ctx, invalidationController, scheduler)

  return {
    vnode: vnodeRef,
    state: reactiveState,
    ctx: ctxRef,
    refs: refsRegistry.getAll(),
    error: errorRef,
    stats: analyzer.stats,
    ...queryApi,
    retry: () => {
      errorRef.value = null
      render()
    }
  }
}
