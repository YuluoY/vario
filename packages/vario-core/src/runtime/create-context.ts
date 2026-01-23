/**
 * RuntimeContext 创建工厂
 * 
 * 实现要点：
 * - 扁平化状态存储
 * - 系统 API 保护（$ 和 _ 前缀）
 * - 命名冲突检测
 * - Proxy 拦截防止覆盖系统 API
 */

import type { RuntimeContext, MethodsRegistry, GetPathValue, SetPathValue, ExpressionOptions } from '../types.js'
import { createProxy } from './proxy.js'
import { registerBuiltinMethods } from '../vm/handlers/index.js'
import { getPathValue as getPath, setPathValue as setPath } from './path.js'
import { invalidateCache } from '../expression/cache.js'

/**
 * RuntimeContext 创建选项
 */
export interface CreateContextOptions {
  /**
   * 事件发射回调
   */
  onEmit?: (event: string, data?: unknown) => void
  
  /**
   * 预注册的方法
   */
  methods?: MethodsRegistry
  
  /**
   * 状态变更钩子（用于框架集成）
   * 在 _set 调用后触发，可用于缓存失效等
   */
  onStateChange?: (path: string, value: unknown, ctx: RuntimeContext) => void
  
  /**
   * 创建对象的工厂函数（用于框架集成创建响应式对象）
   */
  createObject?: () => Record<string, unknown>
  
  /**
   * 创建数组的工厂函数（用于框架集成创建响应式数组）
   */
  createArray?: () => unknown[]

  /**
   * 表达式求值配置
   */
  exprOptions?: ExpressionOptions
}

/**
 * 创建运行时上下文
 * 
 * @param initialState 初始状态（扁平化）
 * @param options 配置选项
 * 
 * @template TState 状态类型，从 initialState 推导
 */
export function createRuntimeContext<
  TState extends Record<string, unknown> = Record<string, unknown>
>(
  initialState: Partial<TState> = {} as Partial<TState>,
  options: CreateContextOptions = {}
): RuntimeContext<TState> {
  // 1. 验证命名冲突
  validateStateKeys(initialState)

  const {
    onEmit,
    methods = {},
    onStateChange,
    createObject = () => ({}),
    createArray = () => [],
    exprOptions
  } = options

  // 用于存储 proxied 引用，以便 _set 中的 onStateChange 能使用正确的引用
  let proxiedRef: RuntimeContext<TState> | null = null

  // 2. 创建基础上下文对象
  const ctx = {
    ...initialState,
    $emit: (event: string, data?: unknown) => {
      if (onEmit) {
        onEmit(event, data)
      }
    },
    $methods: methods as MethodsRegistry,
    $exprOptions: exprOptions,
    _get: <TPath extends string>(path: TPath): GetPathValue<TState, TPath> => {
      return getPath(ctx as Record<string, unknown>, path) as GetPathValue<TState, TPath>
    },
    _set: <TPath extends string>(path: TPath, value: SetPathValue<TState, TPath>, options?: { skipCallback?: boolean }): void => {
      setPath(ctx as Record<string, unknown>, path, value, {
        createObject,
        createArray
      })
      // 使缓存失效（使用 proxied 引用以确保缓存键一致）
      invalidateCache(path, (proxiedRef || ctx) as RuntimeContext)
      // 触发状态变更钩子
      if (onStateChange && !options?.skipCallback) {
        onStateChange(path, value, (proxiedRef || ctx) as RuntimeContext)
      }
    },
  } as RuntimeContext<TState>

  // 3. 自动注册内置指令到 $methods
  registerBuiltinMethods(ctx as RuntimeContext)

  // 4. 使用 Proxy 保护系统 API
  const proxied = createProxy(ctx as unknown as RuntimeContext) as RuntimeContext<TState>
  
  // 5. 保存 proxied 引用供 _set 使用
  proxiedRef = proxied
  
  return proxied
}

/**
 * 验证状态键名，防止与系统 API 冲突
 */
function validateStateKeys(state: Record<string, unknown>): void {
  for (const key in state) {
    if (key.startsWith('$') || key.startsWith('_')) {
      throw new Error(
        `Property name "${key}" conflicts with system API. ` +
        `Properties starting with "$" or "_" are reserved. Use a different name.`
      )
    }
  }
}
