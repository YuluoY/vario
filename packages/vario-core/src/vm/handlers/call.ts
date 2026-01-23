/**
 * call 动作处理器
 * 
 * 功能：调用 method（通过 $methods）
 * 示例：{ "type": "call", "method": "services.fetchUser", "params": {...}, "resultTo": "user" }
 * 
 * 参考文档：action-reference.md - call 动作
 */

import type { RuntimeContext, Action } from '@/types.js'
import { ActionError, ServiceError, ErrorCodes } from '@/errors.js'
import { evaluate } from '@/expression/evaluate.js'
import { invalidateCache } from '@/expression/cache.js'

/**
 * 处理 call 动作
 */
export async function handleCall(
  ctx: RuntimeContext,
  action: Action
): Promise<unknown> {
  const method = action.method as string | undefined
  const params = (action.params || {}) as Record<string, unknown>
  const resultTo = action.resultTo as string | undefined
  
  if (!method || typeof method !== 'string') {
    throw new ActionError(
      action,
      'call action requires "method" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'method' } }
    )
  }
  
  // 查找方法（通过 $methods）
  const handler = ctx.$methods[method]
  if (!handler) {
    throw new ServiceError(
      method,
      `Method "${method}" not found in $methods`,
      undefined,
      {
        metadata: { method }
      }
    )
  }
  
  // 求值参数（支持表达式）
  const finalParams: Record<string, unknown> = {}
  
  try {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const expr = value.slice(2, -2).trim()
        finalParams[key] = evaluate(expr, ctx)
      } else {
        finalParams[key] = value
      }
    }
    
    // 调用 method
    const result = await handler(ctx, finalParams)
    
    // 如果指定了 resultTo，保存结果到状态
    if (resultTo) {
      ctx._set(resultTo, result)
      invalidateCache(resultTo, ctx)
    }
    
    return result
  } catch (error: unknown) {
    // 如果错误已经是 ServiceError，直接抛出
    if (error instanceof ServiceError) {
      throw error
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    const originalError = error instanceof Error ? error : undefined
    
    throw new ServiceError(
      method,
      `Service call failed: ${errorMessage}`,
      originalError,
      {
        metadata: {
          method,
          params: finalParams
        }
      }
    )
  }
}
