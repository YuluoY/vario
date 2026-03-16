import type { RuntimeContext, MethodsRegistry } from '@variojs/types'
import { ServiceError } from '@variojs/core'
import type { MethodContext, UseVarioOptions } from '../../types.js'

/**
 * 兼容别名前缀：用户可在 schema event 中通过 `services.xxx` / `methods.xxx` / `$methods.xxx` 调用
 */
const METHOD_ALIAS_PREFIXES = ['$methods.', 'methods.', 'services.'] as const

/**
 * 构建 methods 注册表
 *
 * 设计说明：
 * - 把用户传入的 methods 统一注册到 RuntimeContext.$methods
 * - 同时注册兼容别名（$methods.x / methods.x / services.x）
 * - 自动兼容同步/异步返回
 * - 统一包装非 ServiceError 异常，保证错误语义一致
 */
export function buildMethodsRegistry<TState extends Record<string, unknown>>(
  methods: UseVarioOptions<TState>['methods'],
  reactiveState: TState
): MethodsRegistry {
  if (!methods) return {}

  const registry: MethodsRegistry = {}

  for (const [name, fn] of Object.entries(methods)) {
    const handler = async (ctx: RuntimeContext, params: unknown) => {
      try {
        // ctx 在运行时是 RuntimeContext<TState>，这里做受控类型收窄
        const methodCtx = ctx as RuntimeContext<TState>
        const eventValue = (ctx as any).$event

        const result = fn({
          state: reactiveState,
          params,
          value: eventValue,
          event: eventValue,
          ctx: methodCtx
        } as MethodContext<TState, any>)

        // 统一兼容 async/sync 方法
        if (
          result &&
          typeof result === 'object' &&
          'then' in result &&
          typeof (result as Promise<unknown>).then === 'function'
        ) {
          return await (result as Promise<unknown>)
        }

        return result
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const originalError = error instanceof Error ? error : undefined

        if (error instanceof ServiceError) {
          throw error
        }

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

    // 注册方法本名 + 兼容别名
    registry[name] = handler
    for (const prefix of METHOD_ALIAS_PREFIXES) {
      registry[`${prefix}${name}`] = handler
    }
  }

  return registry
}
