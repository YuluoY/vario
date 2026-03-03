/**
 * Runtime 相关类型定义
 */

import type { ExpressionOptions } from './expression.js'
import type { SchemaNode } from './schema.js'
import type { GetPathValue, SetPathValue } from './utils.js'

/**
 * 响应式适配器接口
 * 
 * 核心设计：让 RuntimeContext 的状态存储可以适配到不同 UI 框架的响应式系统，
 * 从而消除"双份状态同步"问题。Vue 侧提供 VueReactiveAdapter（内部用 reactive()），
 * React 侧可提供 ReactReactiveAdapter（内部用 useSyncExternalStore + 不可变快照）。
 * 
 * 当 adapter 被注入到 RuntimeContext 后：
 * - _get/_set 通过 adapter 读写状态
 * - Proxy 的 get/set/has/ownKeys trap 也路由到 adapter
 * - 不再需要 onStateChange 做双向同步（因为只有一份状态）
 */
export interface ReactiveAdapter {
  /** 通过路径读取值（支持嵌套路径如 'user.name'） */
  get(path: string): unknown
  /** 通过路径设置值（支持嵌套路径，自动创建中间结构） */
  set(path: string, value: unknown): void
  /** 直接读取顶层属性（供 Proxy get trap 使用） */
  getProperty(key: string): unknown
  /** 直接设置顶层属性（供 Proxy set trap 使用） */
  setProperty(key: string, value: unknown): void
  /** 检查属性是否存在（供 Proxy has trap 和表达式引擎 'name in ctx' 使用） */
  has(key: string): boolean
  /** 返回所有状态键名（供 Proxy ownKeys trap 和 for...in 使用） */
  keys(): string[]
}

/**
 * 方法处理器类型
 * 所有注册到 $methods 的方法必须符合此签名
 * 
 * 注意：动作处理器也通过 $methods 注册，但它们的参数是 Action
 */
export type MethodHandler<TParams = unknown, TResult = unknown> = (
  ctx: any,  // 避免循环依赖，实际上是 RuntimeContext
  params: TParams
) => Promise<TResult> | TResult

/**
 * 动作处理器类型（特殊的方法处理器）
 */
export type ActionHandler = MethodHandler<any, void>

/**
 * 方法注册表类型
 * 支持普通方法和指令处理器
 */
export type MethodsRegistry = Record<string, MethodHandler>

/**
 * 运行时上下文类型
 * 使用交叉类型结合接口，既支持状态类型推导又支持动态属性
 * 
 * @template TState 状态类型，用于类型推导和约束
 * 
 * 设计说明：
 * - 使用接口 + 索引签名，既支持类型推导又支持动态属性
 * - 状态属性通过 TState 泛型约束
 * - 系统 API 使用具体类型定义，确保类型安全
 */
export type RuntimeContext<TState extends Record<string, unknown> = Record<string, unknown>> = 
  // 状态属性（从 TState 推导）
  TState &
  // 系统 API（$ 前缀）
  {
    $emit: (event: string, data?: unknown) => void
    $methods: MethodsRegistry
    $exprOptions?: ExpressionOptions
    /** 
     * 事件值（在事件处理中可用）
     * - 对于 DOM 原生事件：Event 对象
     * - 对于 Vue 组件 emit：emit 的参数值（如 string[]、number 等）
     */
    $event?: unknown
    $item?: TState[keyof TState]  // 循环当前项（在 Table/loop 中可用）
    $index?: number  // 循环索引（在 Table/loop 中可用）
    /** 当前节点（节点上下文功能，在事件处理中可用） */
    $self?: SchemaNode<TState>
    /** 父节点（支持链式访问 $parent.$parent，节点上下文功能） */
    $parent?: SchemaNode<TState> | null
    /** 兄弟节点数组（不包含自身，节点上下文功能） */
    $siblings?: SchemaNode<TState>[]
    /** 子节点数组（节点上下文功能） */
    $children?: SchemaNode<TState>[]
    // 内部方法（路径解析，不对外暴露）
    _get: <TPath extends string>(path: TPath) => GetPathValue<TState, TPath>
    _set: <TPath extends string>(path: TPath, value: SetPathValue<TState, TPath>, options?: { skipCallback?: boolean }) => void
  } &
  // 允许动态添加状态属性（运行时扩展）
  Record<string, unknown>

/**
 * RuntimeContext 创建选项
 * @template TState 与 context 一致的状态类型，供 onStateChange 等回调获得完整类型推导
 */
export interface CreateContextOptions<TState extends Record<string, unknown> = Record<string, unknown>> {
  onEmit?: (event: string, data?: unknown) => void
  methods?: MethodsRegistry
  /** 在 _set 调用后触发，value 类型随 path 推导 */
  onStateChange?: <TPath extends string>(
    path: TPath,
    value: GetPathValue<TState, TPath>,
    ctx: RuntimeContext<TState>
  ) => void
  createObject?: () => Record<string, unknown>
  createArray?: () => unknown[]
  exprOptions?: ExpressionOptions
  /**
   * 响应式适配器（可选）
   * 
   * 提供后，RuntimeContext 的状态读写全部路由到 adapter，
   * 不再在 ctx 内部维护独立的状态副本。
   * 这消除了 useVario 中"双份状态 + 三重锁同步"的复杂度。
   * 
   * 向后兼容：不提供 adapter 时行为与之前完全一致。
   */
  adapter?: ReactiveAdapter
}
