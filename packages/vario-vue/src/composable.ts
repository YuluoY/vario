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
  computed,
  watch,
  nextTick,
  getCurrentInstance,
  h,
  isReactive,
  type Ref,
  type VNode,
  type ComputedRef,
  type App
} from 'vue'
import type { Schema, SchemaNode } from '@variojs/schema'
import type { RuntimeContext, MethodsRegistry, ExpressionOptions, OnStateChangeCallback } from '@variojs/core'
import {
  createRuntimeContext,
  invalidateCache,
  setPathValue,
  ServiceError
} from '@variojs/core'
import { VueRenderer, type VueRendererOptions } from './renderer.js'
import { registerModelConfig } from './bindings.js'
import { RefsRegistry } from './features/refs.js'

export interface MethodContext<TState extends Record<string, unknown> = Record<string, unknown>> {
  state: TState
  params: any
  event?: Event
  ctx: RuntimeContext<TState>
}

export interface UseVarioOptions<TState extends Record<string, unknown> = Record<string, unknown>> {
  /** 初始状态（会自动包裹为响应式对象） */
  state?: TState
  /** 计算属性（Options 风格：函数）或 Composition 风格（ComputedRef） */
  computed?: Record<string, ((state: TState) => any) | ComputedRef<any>>
  /** 方法（统一注册到 $methods） */
  methods?: Record<string, (ctx: MethodContext<TState>) => any>
  /** 双向绑定配置（非标准组件） */
  modelBindings?: Record<string, any>
  /** 事件处理 */
  onEmit?: (event: string, data?: unknown) => void
  /** 错误处理 */
  onError?: (error: Error) => void
  /** 错误边界配置 */
  errorBoundary?: {
    /** 是否启用错误边界（默认 true） */
    enabled?: boolean
    /** 错误显示组件（自定义错误UI） */
    fallback?: (error: Error) => VNode
    /** 错误恢复回调 */
    onRecover?: (error: Error) => void
  }
  /** 渲染器配置 */
  rendererOptions?: VueRendererOptions
  /** Vue 应用实例（用于获取全局组件，非组件上下文时使用，优先级高于 getCurrentInstance） */
  app?: App | null
  /** 全局组件映射（用于非组件上下文，优先级最高） */
  components?: Record<string, any>
  /** 表达式求值配置 */
  exprOptions?: ExpressionOptions
  /** 
   * Model 绑定配置（路径分隔符、默认惰性等）
   * - separator: 路径分隔符，默认 '.'
   * - lazy: 整棵 schema 的 model 默认惰性，true 时不预写 state
   */
  modelOptions?: {
    separator?: string
    lazy?: boolean
  }
}

export interface UseVarioResult<TState extends Record<string, unknown>> {
  vnode: Ref<VNode | null>
  state: TState
  ctx: Ref<RuntimeContext<TState>>
  /** 模板引用（ref）集合，可通过 Schema 中的 ref 属性访问组件实例 */
  refs: Record<string, Ref<any>>
  /** 当前错误（如果有） */
  error: Ref<Error | null>
  /** 手动触发重新渲染（用于错误恢复） */
  retry: () => void
}

// 函数类型定义（用于重载）
type UseVarioOverload = {
  <TState extends Record<string, unknown>>(
    schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>,
    options: UseVarioOptions<TState> & { state: TState }
  ): UseVarioResult<TState>
  <TState extends Record<string, unknown> = Record<string, unknown>>(
    schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>,
    options?: UseVarioOptions<TState>
  ): UseVarioResult<TState>
}

// 实现：使用箭头函数
export const useVario: UseVarioOverload = <TState extends Record<string, unknown>>(
  schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>,
  options: UseVarioOptions<TState> = {}
): UseVarioResult<TState> => {
  const schemaRef = resolveSchema(schema)

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

  // 同步锁，防止双向同步死循环
  let syncing = false
  // 同步路径追踪，用于循环检测
  const syncingPaths = new Set<string>()
  // 延迟引用 render 函数（因为 render 在 ctx 之后定义）
  let renderFn: (() => void) | null = null

  const ctx = createRuntimeContext<TState>({}, {
    onEmit: (event: string, data?: unknown) => {
      options.onEmit?.(event, data)
    },
    methods: methodsRegistry,
    exprOptions: options.exprOptions,
    onStateChange: ((path: string, value: unknown, runtimeCtx: RuntimeContext<TState>) => {
      // 如果正在同步，跳过（防止循环）
      if (syncing) return
      // 循环检测：如果当前路径正在同步，跳过
      if (syncingPaths.has(path)) return

      syncing = true
      syncingPaths.add(path)
      try {
        // 同步到 Vue 响应式状态（自动创建缺失的对象结构）
        setPathValue(
          reactiveState as Record<string, unknown>,
          path,
          value,
          {
            createObject: () => reactive({}),
            createArray: () => reactive([]),
            // 自动创建中间对象，确保路径存在
            createIntermediate: true
          }
        )
        // 缓存失效
        invalidateCache(path, runtimeCtx as RuntimeContext)
        // 触发重新渲染（确保 UI 及时更新）
        if (renderFn) nextTick(renderFn)
      } finally {
        syncingPaths.delete(path)
        syncing = false
      }
    }) as OnStateChangeCallback<TState>,
    createObject: () => reactive({}),
    createArray: () => reactive([])
  })

  // 将初始状态写入 ctx（保持 runtime 与 Vue 一致）
  // 注意：需要在 watch 之前初始化，避免触发不必要的 watch
  // 遍历 reactiveState 的所有属性并同步到 ctx
  // 同时，如果 state 为空，会自动在 onStateChange 中创建结构
  for (const key in reactiveState) {
    if (key.startsWith('$') || key.startsWith('_')) continue
    const value = (reactiveState as Record<string, unknown>)[key]
    ctx._set(key as any, value as any, { skipCallback: true })
  }

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
            vnodeRef.value = createDefaultErrorVNode(err)
          }
        } else {
          vnodeRef.value = createDefaultErrorVNode(err)
        }
      } else {
        // 错误边界未启用，使用原有逻辑
        vnodeRef.value = null
        options.onError?.(err)
      }
    }
  }

  /**
   * 创建默认错误显示VNode
   */
  function createDefaultErrorVNode(error: Error): VNode {
    return h('div', {
      style: {
        padding: '20px',
        border: '2px solid #f56565',
        borderRadius: '4px',
        backgroundColor: '#fff5f5',
        color: '#c53030'
      }
    }, [
      h('div', { style: { fontWeight: 'bold', marginBottom: '10px' } }, '渲染错误'),
      h('div', { style: { marginBottom: '10px' } }, error.message),
      h('button', {
        onClick: () => {
          errorRef.value = null
          render()
        },
        style: {
          padding: '8px 16px',
          backgroundColor: '#4299e1',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }
      }, '重试')
    ])
  }

  // 设置 renderFn 引用，供 onStateChange 使用
  renderFn = render
  
  render()

  // schema 变化重新渲染
  watch(schemaRef, () => nextTick(render), { deep: true, immediate: false })

  // 状态变更同步到 ctx（Options/Composition 都生效）
  // 使用单独的 watchSyncing 标志，避免与 ctx._set 触发的 onStateChange 冲突
  let watchSyncing = false
  watch(reactiveState, () => {
    // 如果正在同步（watch 自身触发），跳过
    if (watchSyncing) return
    
    watchSyncing = true
    try {
      syncStateToContext(reactiveState, ctx, { skipCallback: true })
      
      // 清除表达式缓存（重要：当数组/对象内部变化时，引用不变但内容变了，需要重新求值）
      // 遍历所有顶层属性，使其缓存失效
      for (const key in reactiveState) {
        if (key.startsWith('$') || key.startsWith('_')) continue
        invalidateCache(key, ctx as RuntimeContext)
      }
      
      nextTick(render)
    } finally {
      watchSyncing = false
    }
  }, { deep: true, flush: 'post', immediate: false })

  return {
    vnode: vnodeRef,
    state: reactiveState,
    ctx: ctxRef,
    refs: refsRegistry.getAll(),
    error: errorRef,
    /** 手动触发重新渲染（用于错误恢复） */
    retry: () => {
      errorRef.value = null
      render()
    }
  }
}

// ============================================================================
// 内部工具函数
// ============================================================================

function resolveSchema<TState extends Record<string, unknown>>(
  schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>
): ComputedRef<Schema<TState>> {
  if (typeof schema === 'function') {
    return computed(() => {
      const result = (schema as () => Schema<TState>)()
      if (result && typeof result === 'object' && 'value' in result && 'effect' in result) {
        return (result as unknown as ComputedRef<Schema<TState>>).value
      }
      return result
    })
  }

  if (schema && typeof schema === 'object' && 'value' in schema && 'effect' in schema) {
    return schema as ComputedRef<Schema<TState>>
  }

  return computed(() => schema as Schema<TState>)
}

function isValidSchema(schema: unknown): schema is SchemaNode {
  return schema != null && typeof schema === 'object' && 'type' in (schema as object)
}

function buildMethodsRegistry<TState extends Record<string, unknown>>(
  methods: UseVarioOptions<TState>['methods'],
  reactiveState: TState
): MethodsRegistry {
  if (!methods) return {}

  const registry: MethodsRegistry = {}
  for (const [name, fn] of Object.entries(methods)) {
    const handler = async (ctx: RuntimeContext, params: unknown) => {
      try {
        // 调用方法，自动处理同步/异步
        // ctx 的类型是 RuntimeContext，但 MethodContext 需要 RuntimeContext<TState>
        // 由于 RuntimeContext 是泛型类型，这里使用类型断言是安全的
        const methodCtx = ctx as RuntimeContext<TState>
        const result = fn({ state: reactiveState, params, event: (ctx as any).$event, ctx: methodCtx })
        
        // 自动检测是否为 Promise
        if (result && typeof result === 'object' && 'then' in result && typeof (result as Promise<unknown>).then === 'function') {
          // 是 Promise，等待结果
          return await (result as Promise<unknown>)
        }
        
        // 同步方法，直接返回
        return result
      } catch (error: unknown) {
        // 错误处理：包装为 ServiceError
        const errorMessage = error instanceof Error ? error.message : String(error)
        const originalError = error instanceof Error ? error : undefined
        
        // 如果已经是 ServiceError，直接抛出
        if (error instanceof ServiceError) {
          throw error
        }
        
        // 包装为 ServiceError
        throw new ServiceError(
          name,
          `Method execution failed: ${errorMessage}`,
          originalError,
          {
            metadata: {
              method: name,
              params
            }
          }
        )
      }
    }
    
    // 注册多个别名以支持不同的调用方式
    registry[name] = handler
    registry[`$methods.${name}`] = handler
    registry[`methods.${name}`] = handler
    registry[`services.${name}`] = handler
  }
  return registry
}

function registerComputed<TState extends Record<string, unknown>>(
  computedDefs: Record<string, ((state: TState) => any) | ComputedRef<any>>,
  reactiveState: TState,
  ctx: RuntimeContext<TState>
): void {
  Object.entries(computedDefs).forEach(([key, def]) => {
    // 支持 Composition 风格（传入 ComputedRef）
    let cVal: ComputedRef<any>
    if (def && typeof def === 'object' && 'value' in def && 'effect' in def) {
      // 已经是 ComputedRef
      cVal = def as ComputedRef<any>
    } else {
      // Options 风格：函数
      const fn = def as (state: TState) => any
      cVal = computed(() => fn(reactiveState))
    }
    
    // 监听计算属性变化，同步到运行时上下文
    watch(cVal, (val) => {
      const currentValue = ctx._get(key as any)
      // 深度比较，避免不必要的更新
      if (!isDeepEqual(currentValue, val)) {
        ctx._set(key as any, val as any, { skipCallback: true })
      }
    }, { immediate: true })

    // 将计算属性添加到 state（只读访问）
    // 使用 configurable: true 允许覆盖已存在的属性
    Object.defineProperty(reactiveState, key, {
      get: () => cVal.value,
      enumerable: true,
      configurable: true  // 允许覆盖，因为 computed 优先级高于初始值
    })
  })
}

function syncStateToContext<TState extends Record<string, unknown>>(
  reactiveState: TState,
  ctx: RuntimeContext<TState>,
  _options: { skipCallback?: boolean } = {}
): void {
  for (const key in reactiveState) {
    if (key.startsWith('$') || key.startsWith('_')) continue
    const value = (reactiveState as Record<string, unknown>)[key]
    const currentValue = ctx._get(key as any)
    
    // 深度比较，避免不必要的更新
    if (!isDeepEqual(currentValue, value)) {
      // 使用 skipCallback 避免触发 onStateChange（防止循环）
      ctx._set(key as any, value as any, { skipCallback: true })
    }
  }
}

/**
 * 深度比较两个值是否相等
 */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => isDeepEqual(item, b[index]))
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => isDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  }
  
  return false
}

/**
 * 规范化 modelOptions 配置
 */
function normalizeModelOptions(
  config?: { separator?: string; lazy?: boolean }
): { separator: string; lazy?: boolean } {
  return {
    separator: config?.separator ?? '.',
    lazy: config?.lazy
  }
}

function applyBindingConfigs(bindings?: Record<string, any>): void {
  if (!bindings) return
  Object.entries(bindings).forEach(([key, config]) => {
    if (!config) return
    if (key.includes(':')) {
      const [component, modelName] = key.split(':')
      registerModelConfig(component, config, modelName)
    } else {
      registerModelConfig(key, config)
    }
  })
}
