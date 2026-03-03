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
  reactive,
  toRaw,
  watch,
  nextTick,
  getCurrentInstance,
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
import { VueRenderer } from './renderer.js'
import { RefsRegistry } from './features/refs.js'
import { createSchemaAnalyzer } from './features/schema-analyzer.js'
import { useSchemaQuery } from './composables/useSchemaQuery.js'
import { createVueReactiveAdapter } from './adapter.js'
import { createDefaultErrorVNode } from './composables/internal/error-fallback.js'
import {
  resolveSchema,
  isValidSchema,
  normalizeModelOptions,
  applyBindingConfigs
} from './composables/internal/composable-helpers.js'
import { buildMethodsRegistry } from './composables/internal/method-registry.js'
import { registerComputed } from './composables/internal/computed-registry.js'
import { createInvalidationController } from './composables/internal/invalidation-controller.js'
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

  // 1. 初始化 Schema 分析器 (Lazy)
  const analyzer = createSchemaAnalyzer(schemaRef, {
    lazy: true
  })

  // 获取组件实例（如果可用）
  const instance = getCurrentInstance()

  // 状态：自动包裹为响应式对象
  // 如果传入的 state 已经是响应式的（通过 isReactive 检查），直接使用
  // 否则用 reactive() 包裹
  const reactiveState = (options.state
    ? (isReactive(options.state) ? options.state : reactive(options.state))
    : reactive({} as TState)) as TState

  // 应用自定义绑定协议（可选）
  applyBindingConfigs(options.modelBindings)

  // 构建方法注册表（支持兼容命名）
  const methodsRegistry = buildMethodsRegistry(options.methods, reactiveState)

  // 延迟引用 render 函数（因为 render 在 ctx 之后定义）
  let renderFn: (() => void) | null = null
  
  // 渲染调度：防止同一 tick 内多次渲染导致 VNode 不一致
  let renderScheduled = false
  let isRendering = false

  // 失效控制器：负责路径采集、失效决策与“跳过一次 watch”标记
  const invalidationController = createInvalidationController(reactiveState, toRaw)

  const invalidateTopLevel = (): void => {
    for (const key in reactiveState as Record<string, unknown>) {
      if (key.startsWith('$') || key.startsWith('_')) continue
      invalidateCache(key, ctx as RuntimeContext)
    }
  }

  const scheduleRender = () => {
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

  // ReactiveAdapter：ctx 直接读写 Vue reactive 对象，消除双向同步
  const adapter = createVueReactiveAdapter<TState>(reactiveState)

  const ctx = createRuntimeContext<TState>({}, {
    onEmit: (event: string, data?: unknown) => {
      options.onEmit?.(event, data)
    },
    methods: methodsRegistry,
    exprOptions: options.exprOptions,
    adapter,
    onStateChange: ((_path: string, _value: unknown, _runtimeCtx: RuntimeContext<TState>) => {
      // Adapter 模式下，createRuntimeContext._set 已做 path 级缓存失效；
      // 这里仅做渲染调度，并标记跳过一次 watch 回调，避免重复触发。
      invalidationController.markSkipOnce()
      scheduleRender()
    }) as OnStateChangeCallback<TState>,
  })

  // Adapter 模式：ctx 直接通过 adapter 访问 reactiveState，无需初始拷贝

  // 计算属性（Options 风格）
  if (options.computed) {
    registerComputed(options.computed, reactiveState, ctx)
  }

  const ctxRef = ref(ctx) as Ref<RuntimeContext<TState>>

  // 规范化 modelOptions 配置
  const modelOptionsConfig = normalizeModelOptions(options.modelOptions)

  // 创建 refs 注册表（用于模板引用）
  const refsRegistry = options.rendererOptions?.refsRegistry || new RefsRegistry()

  const renderer = new VueRenderer({
    ...options.rendererOptions,
    instance,
    app: options.app ?? options.rendererOptions?.app,
    components: options.components ?? options.rendererOptions?.components,
    getState: () => reactiveState,
    refsRegistry,
    modelOptions: {
      ...modelOptionsConfig,
      lazy: options.modelOptions?.lazy ?? options.rendererOptions?.modelOptions?.lazy
    }
  })

  // 2. 初始化 Query API
  const queryApi = useSchemaQuery(schemaRef, analyzer, {
    patchNode: (path, patch) => renderer.patchSchemaNode(path, patch)
  })

  const vnodeRef = ref<VNode | null>(null)
  const errorRef = ref<Error | null>(null)
  const errorBoundaryEnabled = options.errorBoundary?.enabled !== false

  const render = () => {
    // 清除之前的错误
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
      
      // 错误边界处理
      if (errorBoundaryEnabled) {
        errorRef.value = err
        
        // 调用错误恢复回调
        if (options.errorBoundary?.onRecover) {
          try {
            options.errorBoundary.onRecover(err)
          } catch (recoverError) {
            console.warn('Error recovery callback failed:', recoverError)
          }
        }
        
        // 显示错误UI
        if (options.errorBoundary?.fallback) {
          try {
            vnodeRef.value = options.errorBoundary.fallback(err)
          } catch (fallbackError) {
            // 回退到默认错误显示
            vnodeRef.value = createDefaultErrorVNode(err, () => {
              errorRef.value = null
              render()
            })
          }
        } else {
          vnodeRef.value = createDefaultErrorVNode(err, () => {
            errorRef.value = null
            render()
          })
        }
      } else {
        // 错误边界未启用，使用原有逻辑
        vnodeRef.value = null
        options.onError?.(err)
      }
    }
  }

  // 设置 renderFn 引用，供 onStateChange 使用
  renderFn = render
  
  render()

  // schema 变化重新渲染（使用调度器防止重复渲染）
  watch(schemaRef, () => scheduleRender(), { deep: true, immediate: false, flush: 'post' })

  // Adapter 模式：Vue reactive 变更自动可见于 ctx，无需 watch 同步
  // 但仍需监听 reactive 变化以失效缓存并触发重渲染
  watch(reactiveState as object, () => {
    if (invalidationController.consumeSkipOnce()) return

    invalidationController.flushPending(
      (path) => invalidateCache(path, ctx as RuntimeContext),
      invalidateTopLevel
    )
    scheduleRender()
  }, {
    deep: true,
    flush: 'sync',
    onTrigger: (event) => {
      invalidationController.collectFromTrigger(event.target, event.key)
    }
  })

  return {
    vnode: vnodeRef,
    state: reactiveState,
    ctx: ctxRef,
    refs: refsRegistry.getAll(),
    error: errorRef,
    stats: analyzer.stats,
    ...queryApi,
    /** 手动触发重新渲染（用于错误恢复） */
    retry: () => {
      errorRef.value = null
      render()
    }
  }
}

