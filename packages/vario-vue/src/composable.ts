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
  shallowRef,
  h,
  toRaw,
  getCurrentInstance,
  isReadonly,
  onUnmounted,
  type Ref,
  type VNode,
  type ComputedRef
} from 'vue'
import type { Schema, SchemaNode } from '@variojs/schema'
import { prepareView } from '@variojs/schema'
import type { RuntimeContext } from '@variojs/types'
import { getPathValue } from '@variojs/core'
import { createSchemaAnalyzer } from './features/schema-analyzer.js'
import { useSchemaQuery } from './composables/useSchemaQuery.js'
import {
  resolveSchema,
} from './composables/internal/composable-helpers.js'
import { registerComputed } from './composables/internal/computed-registry.js'
import { createInvalidationController } from './composables/internal/invalidation-controller.js'
import { getRuntimeMode, compareShadowPlans } from './runtime/runtime-mode.js'
import { PageSession } from './runtime/page-session.js'
import { VueStateBridge } from './runtime/state-bridge.js'
import { VarioRoot } from './components/vario-root.js'
import { VarioLegacyRoot } from './components/legacy-root.js'
import { installRegionInterceptor } from './runtime/prepared-renderer.js'
import { adaptLegacySchema } from './runtime/legacy-prepared-adapter.js'
import {
  initStateAndMethods,
  createRenderScheduler,
  initRuntimeContext,
  initRenderer,
  createRenderWithErrorBoundary,
  setupWatchers
} from './composables/internal/use-vario-phases.js'
import { applySchemaModelDefaults } from './bindings.js'
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
  const runtimeMode = options.runtimeMode ?? getRuntimeMode(options.engineId)
  let prepared = null as ReturnType<typeof prepareView> | null
  if (runtimeMode === 'shadow' || runtimeMode === 'prepared') {
    try {
      prepared = adaptLegacySchema(schemaRef.value as never, { diagnosticSink: options.diagnosticSink })
      if (runtimeMode === 'shadow') {
        compareShadowPlans(schemaRef.value as never, prepared)
      }
    } catch (error) {
      if (runtimeMode === 'prepared') throw error
    }
  }

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
  const namespaceSubscriptions: Array<() => void> = []
  const ctx = initRuntimeContext(reactiveState, methodsRegistry, invalidationController, scheduler, options, namespaceSubscriptions)
  applySchemaModelDefaults(schemaRef.value as SchemaNode, ctx as RuntimeContext, { lazy: options.modelOptions?.lazy === true })

  // Phase 6: Computed 属性
  if (options.computed) {
    registerComputed(options.computed, reactiveState, ctx)
  }

  const ctxRef = shallowRef(ctx) as Ref<RuntimeContext<TState>>

  // Phase 7: Renderer（prepared 也传 instance：用于 appContext 组件解析与 ref owner，T3.3）
  const { renderer, refsRegistry } = initRenderer(
    instance,
    options,
    reactiveState
  )

  // Phase 8: Query API
  const queryApi = useSchemaQuery(schemaRef, analyzer, {
    patchNode: (path, patch) => {
      const root = schemaRef.value as SchemaNode
      if (options.onSchemaPatch) {
        options.onSchemaPatch({ path, patch, root })
        renderer.invalidateScan(root)
        analyzer.refresh()
        scheduler.schedule()
        options.diagnosticSink?.emit({
          name: 'schema-patch',
          diagnostic: { code: 'SCHEMA_PATCH', message: 'schema-patch', path, phase: 'patch' }
        })
        return
      }
      if (isReadonly(root) || Object.isFrozen(root)) {
        throw new Error('Schema is readonly. Provide onSchemaPatch to apply query patches.')
      }
      if (path === '') {
        Object.assign(root, patch)
      } else {
        const node = getPathValue(root as unknown as Record<string, unknown>, path)
        if (!node || typeof node !== 'object') {
          throw new Error(`Cannot patch schema path "${path}": node not found`)
        }
        Object.assign(node as object, patch)
      }
      renderer.invalidateScan(root)
      analyzer.refresh()
      scheduler.schedule()
      options.diagnosticSink?.emit({
        name: 'schema-patch',
        diagnostic: { code: 'SCHEMA_PATCH', message: 'schema-patch', path, phase: 'patch' }
      })
    }
  })

  // Phase 9: Render（含 Error Boundary）
  const vnodeRef = shallowRef<VNode | null>(null)
  const errorRef = shallowRef<Error | null>(null)
  const render = createRenderWithErrorBoundary(schemaRef, renderer, ctx as RuntimeContext, vnodeRef, errorRef, options)

  let pageSession: PageSession | null = null
  const treeAlive = shallowRef(true)
  const viewRevision = shallowRef(0)
  let publicVnode: Ref<VNode | null> = vnodeRef
  // 触发一次重渲染：legacy-instance 模式递增 revision；其余直出/重建
  let triggerRender: () => void = () => render()
  if (runtimeMode === 'prepared' && prepared && !prepared.legacyRequired) {
    const session = new PageSession({ ctx: ctx as RuntimeContext, view: prepared, renderer, engineId: options.engineId, runtimeBudget: options.runtimeBudget, diagnosticSink: options.diagnosticSink })
    pageSession = session
    installRegionInterceptor(session)
    // T3.6：schema 根替换时重建 view/bySchema/sources/bridge
    let lastRoot = schemaRef.value as SchemaNode
    const rebuildView = (): void => {
      const nextRoot = schemaRef.value as SchemaNode
      if (nextRoot === lastRoot || session.status === 'disposed') return
      lastRoot = nextRoot
      try {
        const nextView = adaptLegacySchema(nextRoot as never, { diagnosticSink: options.diagnosticSink })
        session.view = nextView
        session.indexView(nextView)
        session.bridge = new VueStateBridge(nextView, options.runtimeBudget)
      } catch (error) {
        if (error instanceof RangeError) throw error
      }
    }
    const rootId = prepared.rootNodeId ?? 'node:root'
    publicVnode = {
      get value() {
        if (!treeAlive.value || !pageSession || pageSession.status === 'disposed') return null
        return h(VarioRoot, {
          key: viewRevision.value,
          sessionId: session.id,
          rootId: session.view?.rootNodeId ?? rootId
        })
      },
      set value(next: VNode | null) {
        if (next == null) treeAlive.value = false
      }
    } as Ref<VNode | null>
    triggerRender = () => {
      rebuildView()
      viewRevision.value += 1
    }
    scheduler.setRenderFn(triggerRender)
    if (instance) {
      onUnmounted(() => {
        session.dispose()
        pageSession = null
        const host = instance as unknown as Record<string, unknown>
        host.subTree = null
        host.parent = null
        host.root = null
        queueMicrotask(() => {
          host.job = null
          host.update = null
          host.effect = null
          host.render = null
          host.um = null
          host.bum = null
        })
      })
    }
  } else {
    // shadow / legacy-fallback 保留 prepared view（compareShadowPlans 需要）；
    // 纯 legacy 不 prepareView（FR-13），PageSession view=null → 不建 bridge
    let view = prepared
    if (!view && runtimeMode === 'shadow') {
      try {
        view = prepareView(schemaRef.value as never, { diagnosticSink: options.diagnosticSink })
      } catch (error) {
        if (error instanceof RangeError) throw error
        view = null
      }
    }
    pageSession = new PageSession({ ctx: ctx as RuntimeContext, view, renderer, engineId: options.engineId, runtimeBudget: options.runtimeBudget, diagnosticSink: options.diagnosticSink })
    if (!instance) {
      // 无组件实例（SSR/单测）：保持 vnodeRef 直出行为
      render()
    } else {
      // 有实例：VarioLegacyRoot 在组件 render 函数内承载渲染（withDirectives 约束），
      // 宿主只追踪 revision，不再追踪整棵 state
      triggerRender = () => {
        viewRevision.value += 1
      }
      publicVnode = {
        get value() {
          if (!treeAlive.value || (pageSession && pageSession.status === 'disposed')) return null
          return h(VarioLegacyRoot, {
            key: 'vario-legacy-root',
            renderFn: render,
            revision: viewRevision.value
          })
        },
        set value(next: VNode | null) {
          if (next == null) treeAlive.value = false
        }
      } as Ref<VNode | null>
    }
    scheduler.setRenderFn(triggerRender)
    if (instance) {
      onUnmounted(() => {
        pageSession?.dispose()
        pageSession = null
      })
    }
  }
  if (options.virtualAdapter !== undefined && pageSession) pageSession.virtualAdapter = options.virtualAdapter

  const preparedDeepWatch = runtimeMode === 'prepared' && !prepared?.legacyRequired
    && options.runtimeBudget?.deepStateWatch !== false
  setupWatchers(schemaRef, reactiveState, ctx, invalidationController, scheduler, {
    skipDeepStateWatch: runtimeMode === 'prepared' && !prepared?.legacyRequired && !preparedDeepWatch,
    routing: preparedDeepWatch ? 'prepared' : 'legacy',
    session: pageSession
  })

  return {
    vnode: publicVnode,
    state: reactiveState,
    ctx: ctxRef,
    refs: refsRegistry.getAll(),
    error: errorRef,
    stats: analyzer.stats,
    ...queryApi,
    retry: () => {
      errorRef.value = null
      triggerRender()
    },
    pause: () => {
      pageSession?.pause()
    },
    resume: () => {
      pageSession?.resume()
    },
    dispose: () => {
      treeAlive.value = false
      for (const stop of namespaceSubscriptions) stop()
      namespaceSubscriptions.length = 0
      pageSession?.dispose()
      pageSession = null
      vnodeRef.value = null
      ;(ctxRef as { value: RuntimeContext<TState> | null }).value = null
      scheduler.setRenderFn(() => {})
      renderer.release()
      refsRegistry.clear()
      // FR-7：不再清空 reactiveState——宿主共享的 reactive 对象必须保持原样
    }
  }
}
