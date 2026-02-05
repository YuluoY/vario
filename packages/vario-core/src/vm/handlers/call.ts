/**
 * call 动作处理器
 * 
 * 功能：调用 method（通过 $methods）
 * 
 * params 参数支持三种形式：
 * 1. 对象（命名参数）：{ "type": "call", "method": "fetchUser", "params": { id: "{{userId}}" } }
 * 2. 数组（位置参数）：{ "type": "call", "method": "sum", "params": ["{{a}}", "{{b}}"] }
 * 3. 字符串（表达式）：{ "type": "call", "method": "fetchUser", "params": "{{ userParams }}" }
 * 
 * resultTo：将方法返回值保存到状态中
 * 
 * 参考文档：action-reference.md - call 动作
 */

import type { RuntimeContext, Action } from '@variojs/types'
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
  // 类型断言：确保 action 包含 call 动作的属性
  const { method, params: rawParams, resultTo } = action as Action & {
    method?: string
    params?: string | Record<string, unknown> | unknown[]
    resultTo?: string
  }
  
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
  
  // 求值参数（params 支持字符串表达式、对象、数组三种形式）
  let finalParams: unknown
  
  try {
    if (rawParams == null) {
      // 没有 params，使用空对象
      finalParams = {}
    } else if (typeof rawParams === 'string' && rawParams.startsWith('{{') && rawParams.endsWith('}}')) {
      // 字符串表达式，求值
      const expr = rawParams.slice(2, -2).trim()
      finalParams = evaluate(expr, ctx)
    } else if (Array.isArray(rawParams)) {
      // 数组形式（位置参数），求值每个元素
      const evaluatedParams: unknown[] = []
      for (const param of rawParams) {
        if (typeof param === 'string' && param.startsWith('{{') && param.endsWith('}}')) {
          const expr = param.slice(2, -2).trim()
          evaluatedParams.push(evaluate(expr, ctx))
        } else {
          evaluatedParams.push(param)
        }
      }
      finalParams = evaluatedParams
    } else if (typeof rawParams === 'object') {
      // 对象形式（命名参数），求值每个属性
      const evaluatedParams: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(rawParams as Record<string, unknown>)) {
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
          const expr = value.slice(2, -2).trim()
          evaluatedParams[key] = evaluate(expr, ctx)
        } else {
          evaluatedParams[key] = value
        }
      }
      finalParams = evaluatedParams
    } else {
      // 其他情况直接使用
      finalParams = rawParams
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
