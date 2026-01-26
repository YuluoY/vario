/**
 * Vario Core Types
 *
 * 复杂类型集中在此定义，便于推演类型关系、保持业务/运行时逻辑代码简洁。
 * 核心：RuntimeContext、路径值推导(GetPathValue/SetPathValue)、上下文创建选项(CreateContextOptions)等。
 */

/**
 * 方法处理器类型
 * 所有注册到 $methods 的方法必须符合此签名
 * 
 * 注意：动作处理器也通过 $methods 注册，但它们的参数是 Action
 */
export type MethodHandler<TParams = unknown, TResult = unknown> = (
  ctx: RuntimeContext,
  params: TParams
) => Promise<TResult> | TResult

/**
 * 动作处理器类型（特殊的方法处理器）
 */
export type ActionHandler = MethodHandler<Action, void>

/**
 * 方法注册表类型
 * 支持普通方法和指令处理器
 */
export type MethodsRegistry = Record<string, MethodHandler>

/**
 * 表达式求值选项
 */
export interface ExpressionOptions {
  /**
   * 是否允许访问全局对象（默认 false）
   */
  allowGlobals?: boolean
  /**
   * 最大求值步数
   */
  maxSteps?: number
  /**
   * 求值超时（毫秒）
   */
  timeout?: number
  /**
   * 最大嵌套深度（防止 DoS 攻击，默认 50）
   */
  maxNestingDepth?: number
}

/**
 * 运行时上下文接口
 * 扁平化状态设计：直接属性访问，无 models. 前缀
 * 
 * @template TState 状态类型，用于类型推导和约束
 * 
 * 设计说明：
 * - 使用接口 + 索引签名，既支持类型推导又支持动态属性
 * - 状态属性通过 TState 泛型约束
 * - 系统 API 使用具体类型定义，确保类型安全
 */
/**
 * 运行时上下文类型
 * 使用交叉类型结合接口，既支持状态类型推导又支持动态属性
 */
export type RuntimeContext<TState extends Record<string, unknown> = Record<string, unknown>> = 
  // 状态属性（从 TState 推导）
  TState &
  // 系统 API（$ 前缀）
  {
    $emit: (event: string, data?: unknown) => void
    $methods: MethodsRegistry
    $exprOptions?: ExpressionOptions
    $event?: Event  // 事件对象（在事件处理中可用）
    $item?: TState[keyof TState]  // 循环当前项（在 Table/loop 中可用）
    $index?: number  // 循环索引（在 Table/loop 中可用）
    // 内部方法（路径解析，不对外暴露）
    _get: <TPath extends string>(path: TPath) => GetPathValue<TState, TPath>
    _set: <TPath extends string>(path: TPath, value: SetPathValue<TState, TPath>, options?: { skipCallback?: boolean }) => void
  } &
  // 允许动态添加状态属性（运行时扩展）
  Record<string, unknown>

/**
 * 路径值类型推导工具
 * 根据路径字符串推导对应的值类型，支持对象嵌套与数组索引
 *
 * @example
 * GetPathValue<{ user: { name: string } }, 'user.name'> // string
 * GetPathValue<{ items: number[] }, 'items.0'> // number
 * GetPathValue<{ list: { id: number }[] }, 'list.0.id'> // number
 */
export type GetPathValue<T, TPath extends string> =
  TPath extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? T[Key] extends Record<string, unknown>
        ? GetPathValue<T[Key], Rest>
        : T[Key] extends readonly (infer E)[]
          ? Rest extends `${number}`
            ? E
            : Rest extends `${number}.${infer R}`
              ? GetPathValue<E, R>
              : unknown
          : unknown
      : unknown
    : TPath extends keyof T
      ? T[TPath]
      : unknown

/**
 * 路径设置值类型推导工具
 * 根据路径字符串推导可以设置的值类型
 */
export type SetPathValue<T, TPath extends string> = GetPathValue<T, TPath>

// ---------------------------------------------------------------------------
// 上下文创建相关类型（createRuntimeContext 的选项与回调，集中在此便于推演）
// ---------------------------------------------------------------------------

/**
 * 状态变更回调：path 与 value 类型联动，TPath 由 path 推导，value 为 GetPathValue<TState, TPath>
 */
export type OnStateChangeCallback<TState extends Record<string, unknown>> = <TPath extends string>(
  path: TPath,
  value: GetPathValue<TState, TPath>,
  ctx: RuntimeContext<TState>
) => void

/**
 * RuntimeContext 创建选项
 * @template TState 与 context 一致的状态类型，供 onStateChange 等回调获得完整类型推导
 */
export interface CreateContextOptions<TState extends Record<string, unknown> = Record<string, unknown>> {
  onEmit?: (event: string, data?: unknown) => void
  methods?: MethodsRegistry
  /** 在 _set 调用后触发，value 类型随 path 推导 */
  onStateChange?: OnStateChangeCallback<TState>
  createObject?: () => Record<string, unknown>
  createArray?: () => unknown[]
  exprOptions?: ExpressionOptions
}

// ---------------------------------------------------------------------------

/**
 * 动作接口
 * 使用泛型约束，根据 type 类型推导参数结构
 */
export interface Action {
  type: string
  [key: string]: unknown
}

/**
 * 动作类型映射
 * 根据 type 值推导对应的动作参数类型
 */
export type ActionMap = {
  set: { path: string; value: string | unknown }
  emit: { event: string; data?: string | unknown }
  navigate: { to: string }
  log: { level?: 'info' | 'warn' | 'error'; message: string }
  if: { cond: string; then?: Action[]; else?: Action[] }
  loop: { var: string; in: string; body: Action[] }
  call: { method: string; params?: Record<string, unknown>; resultTo?: string }
  batch: { actions: Action[] }
  push: { path: string; value: string | unknown }
  pop: { path: string }
  shift: { path: string }
  unshift: { path: string; value: string | unknown }
  splice: { path: string; start: number | string; deleteCount?: number | string; items?: string | unknown[] }
}

/**
 * 类型守卫：检查动作是否符合特定类型
 */
export function isActionOfType<T extends keyof ActionMap>(
  action: Action,
  actionType: T
): action is Action & ActionMap[T] {
  return action.type === actionType
}

/**
 * 表达式缓存接口
 * 结果类型使用 unknown，因为表达式求值结果类型无法静态推导
 */
export interface ExpressionCache {
  expr: string
  result: unknown  // 表达式求值结果，类型无法静态推导
  dependencies: string[]  // 支持通配符：['items.*', 'user.name']
  timestamp: number
}

/**
 * 错误类型定义
 * 
 * @deprecated 使用 @variojs/core/errors 中的错误类
 * 保留这些导出以保持向后兼容，但建议使用新的错误体系
 */
export {
  ActionError,
  ExpressionError,
  ServiceError,
  BatchError,
  VarioError,
  ErrorCodes,
  type ErrorContext,
  type ErrorCode
} from './errors.js'
