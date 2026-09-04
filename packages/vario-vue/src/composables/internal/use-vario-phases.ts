/**
 * useVario 内部阶段函数
 *
 * 将 useVario 的 ~210 行逻辑按职责拆分为独立阶段，
 * 主 composable 只负责串联阶段和返回结果。
 */

import {
  reactive,
  shallowReactive,
  watch,
  nextTick,
  isReactive,
  onUnmounted,
  markRaw,
  type Ref,
  type VNode,
  type ComputedRef
} from 'vue'
import type { Schema, SchemaNode } from '@variojs/schema'
import type { RuntimeContext, OnStateChangeCallback } from '@variojs/types'
import {
  createRuntimeContext,
  invalidateCache,
  recordChange,
  subscribeChangeSet
} from '@variojs/core'
import { VueRenderer } from '../../renderer.js'
import { RefsRegistry } from '../../features/refs.js'
import { createVueReactiveAdapter, bindAdapterRelease } from '../../adapter.js'
import { createDefaultErrorVNode } from './error-fallback.js'
import { getPageSessionForContext } from '../../runtime/page-session.js'
import {
  isValidSchema,
  normalizeModelOptions
} from './composable-helpers.js'
import { createBindingConfigTable } from '../../bindings.js'
import { buildMethodsRegistry } from './method-registry.js'
import { type InvalidationController } from './invalidation-controller.js'
import type { UseVarioOptions } from '../../types.js'
import type { ComponentInternalInstance } from 'vue'
import { getRuntimeMode } from '../../runtime/runtime-mode.js'

function resolvedRuntimeMode<TState extends Record<string, unknown>>(
  options: UseVarioOptions<TState>
): 'legacy' | 'shadow' | 'prepared' {
  return options.runtimeMode ?? getRuntimeMode(options.engineId)
}

// ─── Phase 1: State & Methods ───

export interface StatePhaseResult<TState extends Record<string, unknown>> {
  reactiveState: TState
  methodsRegistry: Record<string, any>
}

export function initStateAndMethods<TState extends Record<string, unknown>>(
  options: UseVarioOptions<TState>
): StatePhaseResult<TState> {
  // prepared 默认 shallowReactive（性能取舍）；deepStateWatch 开启时恢复 deep
  // reactive 以支持直接改 state（T3.5）
  const isPrepared = resolvedRuntimeMode(options) === 'prepared'
  const wrap = isPrepared && options.runtimeBudget?.deepStateWatch !== false ? reactive
    : isPrepared ? shallowReactive
    : reactive
  const reactiveState = (options.state
    ? (isReactive(options.state) ? options.state : wrap(options.state))
    : wrap({} as TState)) as TState

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
      if (renderScheduled || isRendering) {
        return
      }
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
  _invalidationController: InvalidationController,
  scheduler: RenderScheduler,
  options: UseVarioOptions<TState>,
  subscriptions: Array<() => void> = []
): RuntimeContext<TState> {
  const adapter = createVueReactiveAdapter<TState>(reactiveState, {
    untrackReads: resolvedRuntimeMode(options) === 'prepared'
  })

  const ctx = createRuntimeContext<TState>({}, {
    onEmit: (event: string, data?: unknown) => {
      options.onEmit?.(event, data)
    },
    methods: methodsRegistry,
    exprOptions: options.exprOptions,
    adapter,
    onStateChange: ((_path: string, _value: unknown, _runtimeCtx: RuntimeContext<TState>) => {
      options.onStateChange?.(_path, _value, _runtimeCtx)
    }) as OnStateChangeCallback<TState>,
  })

  // 注入命名空间到 ctx（$variables/$datasources 等，供 cond/show/loop 表达式求值）
  if (options.namespaces) {
    const snapshot = options.namespaces()
    for (const [name, value] of Object.entries(snapshot)) {
      ;(ctx as Record<string, unknown>)[name] = value
    }
  }

  // 订阅命名空间变化：更新 ctx + 失效缓存 + 触发重渲染
  if (options.onNamespacesChange && options.namespaces) {
    const unsub = options.onNamespacesChange(info => {
      try {
        const snapshot = options.namespaces!()
        for (const [name, value] of Object.entries(snapshot)) {
          ;(ctx as Record<string, unknown>)[name] = value
          const changedPath =
            info?.path && (!info.namespace || info.namespace === name)
              ? `${name}.${info.path}`
              : name
          invalidateCache(changedPath, ctx as RuntimeContext)
        }
        scheduler.schedule()
      } catch (e) {
        console.error('[Vario] onNamespacesChange handler error:', e)
      }
    })
    if (unsub) {
      let stopped = false
      const stop = () => {
        if (stopped) return
        stopped = true
        unsub()
      }
      subscriptions.push(stop)
      onUnmounted(stop)
    }
  }

  bindAdapterRelease(ctx, adapter)
  return markRaw(ctx)
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
    runtimeMode: resolvedRuntimeMode(options),
    modelOptions: {
      ...modelOptionsConfig,
      lazy: options.modelOptions?.lazy
    },
    modelConfigs: createBindingConfigTable(options.modelBindings),
    diagnosticSink: options.diagnosticSink
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
): () => VNode | null {
  const errorBoundaryEnabled = options.errorBoundary?.enabled !== false

  return () => {
    if (errorRef.value && errorBoundaryEnabled) {
      errorRef.value = null
    }

    try {
      const currentSchema = schemaRef.value
      if (!isValidSchema(currentSchema)) {
        vnodeRef.value = null
        return null
      }
      const vnode = renderer.render(currentSchema as SchemaNode, ctx as RuntimeContext)
      vnodeRef.value = vnode
      return vnode
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const session = getPageSessionForContext(ctx)
      session?.sink.emit({
        name: 'render-error',
        sessionId: session.id,
        engineId: session.runtime.engineId,
        pageId: session.id,
        schemaId: session.view?.id,
        revision: session.view?.revision,
        diagnostic: {
          code: 'RENDER_ERROR',
          message: 'render-error',
          path: '',
          phase: 'render',
          engineId: session.runtime.engineId,
          pageId: session.id,
          schemaId: session.view?.id,
          revision: session.view?.revision
        }
      })

      if (errorBoundaryEnabled) {
        errorRef.value = err

        if (options.errorBoundary?.onRecover) {
          try { options.errorBoundary.onRecover(err) }
          catch (recoverError) { console.warn('Error recovery callback failed:', recoverError) }
        }

        if (options.errorBoundary?.fallback) {
          try {
            const fallbackVNode = options.errorBoundary.fallback(err)
            vnodeRef.value = fallbackVNode
            return fallbackVNode
          } catch {
            const fallbackVNode = createDefaultErrorVNode(err, () => { errorRef.value = null; vnodeRef.value = renderer.render(schemaRef.value as SchemaNode, ctx as RuntimeContext) })
            vnodeRef.value = fallbackVNode
            return fallbackVNode
          }
        }
        const fallbackVNode = createDefaultErrorVNode(err, () => { errorRef.value = null; vnodeRef.value = renderer.render(schemaRef.value as SchemaNode, ctx as RuntimeContext) })
        vnodeRef.value = fallbackVNode
        return fallbackVNode
      }
      vnodeRef.value = null
      options.onError?.(err)
      return null
    }
  }
}

export function setupWatchers<TState extends Record<string, unknown>>(
  schemaRef: ComputedRef<Schema<TState>>,
  reactiveState: TState,
  ctx: RuntimeContext<TState>,
  invalidationController: InvalidationController,
  scheduler: RenderScheduler,
  options: {
    skipDeepStateWatch?: boolean
    /** prepared 路由：直接改 state 转为 recordChange（memo/bridge 由 PageSession 订阅推进，T3.5） */
    routing?: 'legacy' | 'prepared'
    session?: { memo: { nextGeneration(): number }; view: { rootNodeId?: string } | null; bridge: { tokenFor(id: string): { value: number | undefined } } | null } | null
  } = {}
): void {
  watch(schemaRef, () => scheduler.schedule(), { deep: false, immediate: false, flush: 'post' })

  if (options.skipDeepStateWatch) {
    return
  }

  const routing = options.routing ?? 'legacy'

  // 自上次 watch flush 以来 _set/recordChange 已精确失效过的根键：
  // 生产环境（无 onTrigger 路径采集）的兜底失效跳过它们，避免全量 invalidateTopLevel
  const recordedRoots = new Set<string>()
  subscribeChangeSet(ctx as RuntimeContext, cs => {
    for (const path of cs.paths) {
      recordedRoots.add(path.split(/[.[]/, 1)[0])
    }
  })

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
  const invalidatePathChain = (path: string): void => {
    const c = ctx as RuntimeContext
    invalidateCache(path, c)
    // 祖先链失效：数组 push 等下标变更（list.2）需级联到 list.length 等兄弟依赖
    for (let dot = path.lastIndexOf('.'); dot > 0; dot = path.lastIndexOf('.', dot - 1)) {
      invalidateCache(path.slice(0, dot), c)
    }
  }
  watch(reactiveState as object, () => {
    if (routing === 'prepared') {
      // prepared：采集路径转 recordChange（memo.bumpAll + bridge.apply 由
      // PageSession 的 change 订阅推进）；采集不到时 nextGeneration + 根 token 兜底。
      // 不调 scheduler.schedule()：viewRevision++ 会换 key 重建整树，
      // 破坏 region token 的精细更新（PERF-A2）。
      invalidationController.flushPending(
        (path) => {
          recordChange(ctx as RuntimeContext, path, (ctx as RuntimeContext)._get(path))
          // 数组下标写入（push 触发的 list.2）级联记录 parent.length：
          // 覆盖 {{ list.length }} 依赖；不做全祖先链——那会把 values.i 的
          // 精确依赖全部命中，破坏区域渲染局部性（PERF-A2）
          const indexMatch = path.match(/^(.*)[.[](\d+)$/)
          if (indexMatch) {
            const lengthPath = `${indexMatch[1]}.length`
            recordChange(ctx as RuntimeContext, lengthPath, (ctx as RuntimeContext)._get(lengthPath))
          }
        },
        () => {
          options.session?.memo.nextGeneration()
          const rootId = options.session?.view?.rootNodeId
          if (rootId && options.session?.bridge) {
            const token = options.session.bridge.tokenFor(rootId)
            token.value = (token.value ?? 0) + 1
          }
        }
      )
      return
    }
    invalidationController.flushPending(invalidatePathChain, () => {
      // 无路径信息（生产无 onTrigger）：跳过 _set 已精确失效的根键，
      // 其余根键兜底失效一次（覆盖直接改 state）
      for (const key in reactiveState as Record<string, unknown>) {
        if (!key.startsWith('$') && !key.startsWith('_') && !recordedRoots.has(key)) {
          invalidateCache(key, ctx as RuntimeContext)
        }
      }
    })
    recordedRoots.clear()
    scheduler.schedule()
  }, watchOptions)
}
