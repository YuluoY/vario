/**
 * RuntimeContext 创建工厂
 *
 * 实现要点：扁平化状态存储、系统 API 保护、命名冲突检测、Proxy 保护。
 * 复杂类型见 ../types.ts（CreateContextOptions、OnStateChangeCallback 等）。
 */

import type {
  RuntimeContext,
  CreateContextOptions,
  MethodsRegistry,
  GetPathValue,
  SetPathValue,
  OnStateChangeCallback
} from '@variojs/types'
import { createProxy } from './proxy.js'
import { getPathValue as getPath, setPathValue as setPath, parsePathCached } from './path.js'
import { assertWritablePath } from './path-policy.js'
import { invalidateCache } from '../expression/cache.js'
import { PathWriteError, ErrorCodes } from '../errors.js'
import { assertSessionCanWrite, getExecutionSession } from '../vm/execution-session.js'
import { isContextDisposed, emitContextDiagnostic } from './runtime-session.js'
import { recordChange } from './change-set.js'

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
    createObject = () => Object.create(null) as Record<string, unknown>,
    createArray = () => [],
    exprOptions,
    adapter
  } = options

  const methodsTable = Object.create(null) as MethodsRegistry
  for (const key of Object.keys(methods)) {
    if (Object.prototype.hasOwnProperty.call(methods, key)) {
      methodsTable[key] = methods[key]
    }
  }

  // 用于存储 proxied 引用，以便 _set 中的 onStateChange 能使用正确的引用
  let proxiedRef: RuntimeContext<TState> | null = null

  // 2. 创建基础上下文对象
  //    当有 adapter 时，状态由 adapter 管理，不在 ctx 上展开
  //    Proxy 会将状态属性的读写路由到 adapter
  const ctx = {
    ...(adapter ? {} : initialState),
    $emit: (event: string, data?: unknown) => {
      if (onEmit) {
        onEmit(event, data)
      }
    },
    $methods: methodsTable,
    $exprOptions: exprOptions,
    _get: <TPath extends string>(path: TPath): GetPathValue<TState, TPath> => {
      if (adapter) {
        return adapter.get(path) as GetPathValue<TState, TPath>
      }
      return getPath(ctx as Record<string, unknown>, path) as GetPathValue<TState, TPath>
    },
    _set: <TPath extends string>(path: TPath, value: SetPathValue<TState, TPath>, options?: { skipCallback?: boolean; bypassSession?: boolean }): void => {
      const targetCtx = (proxiedRef || ctx) as RuntimeContext
      if (isContextDisposed(targetCtx)) {
        // disposed 后写入：静默忽略 + 诊断（FR-7）；execute 仍抛 SESSION_DISPOSED
        emitContextDiagnostic(targetCtx, {
          name: 'state-write',
          diagnostic: {
            code: ErrorCodes.SESSION_DISPOSED_WRITE,
            message: 'write to disposed context ignored',
            path,
            phase: 'runtime'
          }
        })
        return
      }
      if (!options?.bypassSession) {
        assertSessionCanWrite(targetCtx)
        // batch journal：记录 (path, oldValue) 供逆序回滚
        const journal = getExecutionSession(targetCtx)?.journal
        if (journal && !journal.committed && !journal.rolledBack) {
          journal.record(path, adapter ? adapter.get(path) : getPath(ctx as Record<string, unknown>, path))
        }
      }
      const segments = parsePathCached(path)
      assertWritablePath(path, segments)

      if (adapter) {
        adapter.set(path, value)
      } else {
        const ok = setPath(ctx as Record<string, unknown>, path, value, {
          createObject,
          createArray
        })
        if (!ok) {
          throw new PathWriteError(
            path,
            `Failed to write path "${path}"`,
            ErrorCodes.PATH_WRITE_ERROR
          )
        }
      }
      // 使缓存失效（使用 proxied 引用以确保缓存键一致）
      invalidateCache(path, targetCtx)
      recordChange(targetCtx, path, value)
      if (onStateChange && !options?.skipCallback) {
        ;(onStateChange as OnStateChangeCallback<TState>)(path, value, proxiedRef || ctx)
      }
    },
  } as RuntimeContext<TState>

  // 使用 Proxy 保护系统 API（传入 adapter 以路由状态访问）
  const proxied = createProxy(ctx as unknown as RuntimeContext, adapter) as RuntimeContext<TState>
  
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
