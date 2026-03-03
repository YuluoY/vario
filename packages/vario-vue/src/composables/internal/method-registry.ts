import type { RuntimeContext, MethodsRegistry } from '@variojs/types'
import { ServiceError } from '@variojs/core'
import type { MethodContext, UseVarioOptions } from '../../types.js'

/**
 * 构建 methods 注册表
 *
 * 设计说明：
 * - 把用户传入的 methods 统一注册到 RuntimeContext.$methods
 * - 同时注册多种兼容别名（$methods / methods / services）
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

    // 注册多个别名以支持不同历史调用方式
    registry[name] = handler
    registry[`$methods.${name}`] = handler
    registry[`methods.${name}`] = handler
    registry[`services.${name}`] = handler
  }

  return registry
}
