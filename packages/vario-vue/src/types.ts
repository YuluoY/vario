/**
 * Vue 特有的类型定义
 * 
 * 扩展 SchemaNode 以支持 Vue 的特性：
 * - ref: 模板引用（声明映射到 Vue ref）
 * - 生命周期钩子（声明映射到 Vue 钩子）
 * - provide/inject: 依赖注入（声明映射到 Vue API）
 * - teleport: 传送
 * - transition: 过渡动画
 * - keep-alive: 缓存
 * 
 * 注意：computed 和 watch 不在 Schema 中定义，
 * 应该在 Vue 组件中使用原生 API 定义，然后通过 useVario 的 computed 选项传入
 */

import type { Schema, SchemaNode } from '@variojs/schema'
import type { RuntimeContext, ExpressionOptions } from '@variojs/types'
import type { Ref, VNode, ComputedRef, App } from 'vue'
import type { VueRendererOptions } from './renderer.js'
import type { SchemaStats } from './features/schema-analyzer.js'
import type { SchemaQueryApi } from './composables/useSchemaQuery.js'

/**
 * Vue 特有的 SchemaNode 扩展
 * 深度集成 Vue 3 的 Composition API 特性
 */
export interface VueSchemaNode extends SchemaNode {
  /** 
   * 模板引用名称（类似 Vue 的 ref）
   * 在 useVario 返回的 refs 对象中可以通过此名称访问组件实例
   * 
   * @example
   * // Schema 中
   * { type: 'ElInput', ref: 'inputRef' }
   * 
   * // 使用
   * const { refs } = useVario(schema, options)
   * refs.inputRef.value?.focus() // 访问组件实例
   */
  readonly ref?: string

  /** 
   * 组件挂载后调用（引用 methods 中的方法名）
   */
  readonly onMounted?: string
  /** 
   * 组件卸载前调用（引用 methods 中的方法名）
   */
  readonly onUnmounted?: string
  /** 
   * 组件更新后调用（引用 methods 中的方法名）
   */
  readonly onUpdated?: string
  /** 
   * 组件挂载前调用（引用 methods 中的方法名）
   */
  readonly onBeforeMount?: string
  /** 
   * 组件卸载前调用（引用 methods 中的方法名）
   */
  readonly onBeforeUnmount?: string
  /** 
   * 组件更新前调用（引用 methods 中的方法名）
   */
  readonly onBeforeUpdate?: string

  /**
   * Provide 值（向下传递数据）
   * 
   * 支持表达式：值为字符串时会尝试作为表达式求值
   * 
   * @example
   * { type: 'div', provide: { theme: 'dark', locale: 'currentLocale' } }
   */
  readonly provide?: Record<string, any>

  /**
   * Inject 依赖（从父组件获取数据）
   * 
   * 支持三种形式：
   * - 数组: ['theme', 'locale']
   * - 简单映射: { myTheme: 'theme' }
   * - 完整配置: { myTheme: { from: 'theme', default: 'light' } }
   * 
   * @example
   * { type: 'ElButton', inject: ['theme', 'locale'] }
   * { type: 'ElButton', inject: { myTheme: { from: 'theme', default: 'light' } } }
   */
  readonly inject?: string[] | Record<string, string | { from?: string; default?: any }>

  /**
   * Teleport 目标（将组件传送到指定 DOM 节点）
   * 
   * @example
   * { type: 'div', teleport: 'body' }  // 传送到 body
   * { type: 'div', teleport: '#modal' }  // 传送到 #modal
   */
  readonly teleport?: string | boolean

  /**
   * Transition 配置（过渡动画）
   * 
   * @example
   * { 
   *   type: 'div',
   *   transition: 'fade',  // 使用预设过渡
   *   // 或
   *   transition: {
   *     name: 'fade',
   *     appear: true,
   *     mode: 'out-in'
   *   }
   * }
   */
  readonly transition?: string | {
    name?: string
    appear?: boolean
    mode?: 'default' | 'in-out' | 'out-in'
    duration?: number | { enter?: number; leave?: number }
  }

  /**
   * Keep-alive 配置（缓存组件状态）
   * 
   * @example
   * { type: 'div', keepAlive: true }
   * { type: 'div', keepAlive: { include: 'ComponentA', exclude: 'ComponentB' } }
   */
  readonly keepAlive?: boolean | {
    include?: string | RegExp | Array<string | RegExp>
    exclude?: string | RegExp | Array<string | RegExp>
    max?: number
  }
}

/**
 * useVario 方法上下文
 *
 * 说明：
 * - 该类型用于 `options.methods` 中每个方法的参数类型推导
 * - 同时兼容 `value`（推荐）与 `event`（向后兼容）两种事件值读取方式
 */
export interface MethodContext<TState extends Record<string, unknown> = Record<string, unknown>, TEvent = unknown> {
  /** 响应式状态对象 */
  state: TState
  /** Schema 中定义的 params 参数 */
  params: any
  /**
   * 事件值（Vue 组件 emit 的参数或原生 DOM 事件）
   * 推荐优先使用该字段
   */
  value: TEvent
  /** @deprecated 请使用 value 代替，此属性仅用于向后兼容 */
  event?: TEvent
  /** 完整运行时上下文（包含 state、$methods、_get/_set 等） */
  ctx: RuntimeContext<TState>
}

/**
 * useVario 配置项
 */
export interface UseVarioOptions<TState extends Record<string, unknown> = Record<string, unknown>> {
  /** 初始状态（会自动包裹为响应式对象） */
  state?: TState
  /** 计算属性（Options 风格函数）或 Composition 风格（ComputedRef） */
  computed?: Record<string, ((state: TState) => any) | ComputedRef<any>>
  /** 方法（统一注册到 $methods） */
  methods?: Record<string, (ctx: MethodContext<TState, any>) => any>
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
    /** 自定义错误显示节点 */
    fallback?: (error: Error) => VNode
    /** 错误恢复回调 */
    onRecover?: (error: Error) => void
  }
  /** 渲染器配置 */
  rendererOptions?: VueRendererOptions
  /** Vue 应用实例（用于非组件上下文，优先级高于 getCurrentInstance） */
  app?: App | null
  /** 全局组件映射（用于非组件上下文，优先级最高） */
  components?: Record<string, any>
  /** 表达式求值配置 */
  exprOptions?: ExpressionOptions
  /**
   * Model 绑定配置（供外部/扩展使用）
   * - separator: 路径分隔符，默认 '.'
   * - lazy: 整棵 schema 的 model 默认惰性，true 时不预写 state
   */
  modelOptions?: {
    separator?: string
    lazy?: boolean
  }
}

/**
 * useVario 返回值
 */
export interface UseVarioResult<TState extends Record<string, unknown>> extends SchemaQueryApi {
  /** 当前渲染结果 */
  vnode: Ref<VNode | null>
  /** 响应式 state */
  state: TState
  /** RuntimeContext 引用 */
  ctx: Ref<RuntimeContext<TState>>
  /** 模板引用（ref）集合 */
  refs: Record<string, Ref<any>>
  /** 当前错误（如果有） */
  error: Ref<Error | null>
  /** Schema 统计信息 */
  stats: Ref<SchemaStats>
  /** 手动触发重新渲染（用于错误恢复） */
  retry: () => void
}

/**
 * useVario 的函数重载签名
 */
export type UseVarioOverload = {
  <TState extends Record<string, unknown>>(
    schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>,
    options: UseVarioOptions<TState> & { state: TState }
  ): UseVarioResult<TState>
  <TState extends Record<string, unknown> = Record<string, unknown>>(
    schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>,
    options?: UseVarioOptions<TState>
  ): UseVarioResult<TState>
}
