/**
 * useVario 内部阶段函数
 *
 * 将 useVario 的 ~210 行逻辑按职责拆分为独立阶段，
 * 主 composable 只负责串联阶段和返回结果。
 */

import {
  ref,
  reactive,
  toRaw,
  watch,
  nextTick,
  isReactive,
  type Ref,
  type VNode,
  type ComputedRef
} from 'vue'
import type { Schema, SchemaNode } from '@variojs/schema'
import type { RuntimeContext, OnStateChangeCallback } from '@variojs/types'
import {
  createRuntimeContext,
  invalidateCache
} from '@variojs/core'
import { VueRenderer } from '../../renderer.js'
import { RefsRegistry } from '../../features/refs.js'
import { createVueReactiveAdapter } from '../../adapter.js'
import { createDefaultErrorVNode } from './error-fallback.js'
import {
  isValidSchema,
  normalizeModelOptions,
  applyBindingConfigs
} from './composable-helpers.js'
import { buildMethodsRegistry } from './method-registry.js'
import { registerComputed } from './computed-registry.js'
import { createInvalidationController, type InvalidationController } from './invalidation-controller.js'
import type { UseVarioOptions } from '../../types.js'
import type { ComponentInternalInstance } from 'vue'

// ─── Phase 1: State & Methods ───

export interface StatePhaseResult<TState extends Record<string, unknown>> {
  reactiveState: TState
  methodsRegistry: Record<string, any>
}

export function initStateAndMethods<TState extends Record<string, unknown>>(
  options: UseVarioOptions<TState>
): StatePhaseResult<TState> {
  const reactiveState = (options.state
    ? (isReactive(options.state) ? options.state : reactive(options.state))
    : reactive({} as TState)) as TState

  applyBindingConfigs(options.modelBindings)

  const methodsRegistry = buildMethodsRegistry(options.methods, reactiveState)

  return { reactiveState, methodsRegistry }
}

// ─── Phase 2: Render Scheduler ───

export interface RenderScheduler {
  /** 设置实际的 render 函数引用 */
  setRenderFn: (fn: () => void) => void
  /** 调度一次渲染（nextTick 去重） */
  schedule: () => void
}

export function createRenderScheduler(): RenderScheduler {
  let renderFn: (() => void) | null = null
  let renderScheduled = false
  let isRendering = false

  return {
    setRenderFn: (fn) => { renderFn = fn },
    schedule: () => {
      if (renderScheduled || isRendering) return
      renderScheduled = true
      nextTick(() => {
        renderScheduled = false
        if (renderFn && !isRendering) {
          isRendering = true
          try {
            renderFn()
          } finally {
            isRendering = false
          }
        }
      })
    }
  }
}

// ─── Phase 3: Runtime Context ───

export function initRuntimeContext<TState extends Record<string, unknown>>(
  reactiveState: TState,
  methodsRegistry: Record<string, any>,
  invalidationController: InvalidationController,
  scheduler: RenderScheduler,
  options: UseVarioOptions<TState>
): RuntimeContext<TState> {
  const adapter = createVueReactiveAdapter<TState>(reactiveState)

  return createRuntimeContext<TState>({}, {
    onEmit: (event: string, data?: unknown) => {
      options.onEmit?.(event, data)
    },
    methods: methodsRegistry,
    exprOptions: options.exprOptions,
    adapter,
    onStateChange: ((_path: string, _value: unknown, _runtimeCtx: RuntimeContext<TState>) => {
      invalidationController.markSkipOnce()
      scheduler.schedule()
    }) as OnStateChangeCallback<TState>,
  })
}

// ─── Phase 4: Renderer ───

export function initRenderer<TState extends Record<string, unknown>>(
  instance: ComponentInternalInstance | null,
  options: UseVarioOptions<TState>,
  reactiveState: TState
): { renderer: VueRenderer; refsRegistry: RefsRegistry } {
  const modelOptionsConfig = normalizeModelOptions(options.modelOptions)
  const refsRegistry = new RefsRegistry()

  const renderer = new VueRenderer({
    instance,
    app: options.app,
    components: options.components,
    directives: options.directives,
    getState: () => reactiveState,
    refsRegistry,
    modelOptions: {
      ...modelOptionsConfig,
      lazy: options.modelOptions?.lazy
    }
  })

  return { renderer, refsRegistry }
}

// ─── Phase 5: Error-Boundary Render ───

export function createRenderWithErrorBoundary<TState extends Record<string, unknown>>(
  schemaRef: ComputedRef<Schema<TState>>,
  renderer: VueRenderer,
  ctx: RuntimeContext,
  vnodeRef: Ref<VNode | null>,
  errorRef: Ref<Error | null>,
  options: UseVarioOptions<TState>
): () => void {
  const errorBoundaryEnabled = options.errorBoundary?.enabled !== false

  return () => {
    if (errorRef.value && errorBoundaryEnabled) {
      errorRef.value = null
    }

    try {
      const currentSchema = schemaRef.value
      if (!isValidSchema(currentSchema)) {
        vnodeRef.value = null
        return
      }
      vnodeRef.value = renderer.render(currentSchema as SchemaNode, ctx as RuntimeContext)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      if (errorBoundaryEnabled) {
        errorRef.value = err

        if (options.errorBoundary?.onRecover) {
          try { options.errorBoundary.onRecover(err) }
          catch (recoverError) { console.warn('Error recovery callback failed:', recoverError) }
        }

        if (options.errorBoundary?.fallback) {
          try {
            vnodeRef.value = options.errorBoundary.fallback(err)
          } catch {
            vnodeRef.value = createDefaultErrorVNode(err, () => { errorRef.value = null; vnodeRef.value = renderer.render(schemaRef.value as SchemaNode, ctx as RuntimeContext) })
          }
        } else {
          vnodeRef.value = createDefaultErrorVNode(err, () => { errorRef.value = null; vnodeRef.value = renderer.render(schemaRef.value as SchemaNode, ctx as RuntimeContext) })
        }
      } else {
        vnodeRef.value = null
        options.onError?.(err)
      }
    }
  }
}

// ─── Phase 6: Reactive Watchers ───

export function setupWatchers<TState extends Record<string, unknown>>(
  schemaRef: ComputedRef<Schema<TState>>,
  reactiveState: TState,
  ctx: RuntimeContext<TState>,
  invalidationController: InvalidationController,
  scheduler: RenderScheduler
): void {
  // schema 变化重新渲染
  watch(schemaRef, () => scheduler.schedule(), { deep: true, immediate: false, flush: 'post' })

  const invalidateTopLevel = (): void => {
    for (const key in reactiveState as Record<string, unknown>) {
      if (key.startsWith('$') || key.startsWith('_')) continue
      invalidateCache(key, ctx as RuntimeContext)
    }
  }

  // reactive state 变化失效缓存并触发重渲染
  const watchOptions: Parameters<typeof watch>[2] = {
    deep: true,
    flush: 'sync',
  }
  if (process.env.NODE_ENV !== 'production') {
    watchOptions.onTrigger = (event) => {
      invalidationController.collectFromTrigger(event.target, event.key)
    }
  }
  watch(reactiveState as object, () => {
    if (invalidationController.consumeSkipOnce()) return

    invalidationController.flushPending(
      (path) => invalidateCache(path, ctx as RuntimeContext),
      invalidateTopLevel
    )
    scheduler.schedule()
  }, watchOptions)
}
