/**
 * RuntimeContext 创建工厂
 *
 * 实现要点：扁平化状态存储、系统 API 保护、命名冲突检测、Proxy 保护。
 * 复杂类型见 ../types.ts（CreateContextOptions、OnStateChangeCallback 等）。
 */

import type {
  RuntimeContext,
  CreateContextOptions,
  OnStateChangeCallback,
  MethodsRegistry,
  GetPathValue,
  SetPathValue,
} from '../types.js'
import { createProxy } from './proxy.js'
import { registerBuiltinMethods } from '../vm/handlers/index.js'
import { getPathValue as getPath, setPathValue as setPath } from './path.js'
import { invalidateCache } from '../expression/cache.js'

/**
 * 创建运行时上下文（传入具体 initialState 时，TState 从实参自动推导）
 */
export function createRuntimeContext<TState extends Record<string, unknown>>(
  initialState: TState,
  options?: CreateContextOptions<TState>
): RuntimeContext<TState>
/**
 * 创建运行时上下文（显式指定 TState 时可传空或部分初始状态，如 createRuntimeContext<MyState>({}, options)）
 */
export function createRuntimeContext<TState extends Record<string, unknown>>(
  initialState: Partial<TState> & Record<string, unknown>,
  options?: CreateContextOptions<TState>
): RuntimeContext<TState>
/**
 * 创建运行时上下文（不传或传空且未指定 TState 时，退回 Record<string, unknown>）
 */
export function createRuntimeContext(
  initialState?: Record<string, unknown>,
  options?: CreateContextOptions<Record<string, unknown>>
): RuntimeContext<Record<string, unknown>>
export function createRuntimeContext<TState extends Record<string, unknown>>(
  initialState: Partial<TState> & Record<string, unknown> = {} as Partial<TState> & Record<string, unknown>,
  options: CreateContextOptions<TState> | CreateContextOptions<Record<string, unknown>> = {}
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
      if (onStateChange && !options?.skipCallback) {
        ;(onStateChange as OnStateChangeCallback<TState>)(path, value, proxiedRef || ctx)
      }
    },
  } as RuntimeContext<TState>

  // 3. 自动注册内置指令到 $methods（RuntimeContext<TState> 与 RuntimeContext 在 _set 值域上逆变，需通过 unknown 转接）
  registerBuiltinMethods(ctx as unknown as RuntimeContext)

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
