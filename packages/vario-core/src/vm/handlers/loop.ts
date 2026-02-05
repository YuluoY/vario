/**
 * loop 动作处理器
 * 
 * 功能：循环执行
 * 示例：{ "type": "loop", "var": "item", "in": "items", "body": [...] }
 */

import type { RuntimeContext, Action } from '@variojs/types'
import { ActionError, ErrorCodes } from '@/errors.js'
import { evaluate } from '@/expression/evaluate.js'
import { invalidateCache } from '@/expression/cache.js'
import { execute } from '../executor.js'
import { createLoopContext, releaseLoopContext } from '@/runtime/loop-context-pool.js'

/**
 * 处理 loop 动作
 */
export async function handleLoop(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  // 类型断言：确保 action 包含 loop 动作的属性
  const { var: varName, in: inExpr, body } = action as Action & { var?: string; in?: string; body?: Action[] }
  
  if (!varName || typeof varName !== 'string') {
    throw new ActionError(
      action,
      'loop action requires "var" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'var' } }
    )
  }
  
  if (!inExpr || typeof inExpr !== 'string') {
    throw new ActionError(
      action,
      'loop action requires "in" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'in' } }
    )
  }
  
  if (!body || !Array.isArray(body)) {
    throw new ActionError(
      action,
      'loop action requires "body" parameter (array of actions)',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'body' } }
    )
  }
  
  // 求值 in 表达式，获取要遍历的数组或对象
  const iterable = evaluate(inExpr, ctx)
  
  if (iterable == null) {
    return
  }
  
  // 遍历数组
  if (Array.isArray(iterable)) {
    for (let i = 0; i < iterable.length; i++) {
      // 使用对象池创建循环上下文
      const loopCtx = createLoopContext(ctx, iterable[i], i)
      loopCtx[varName] = iterable[i]
      
      try {
        // 触发缓存失效，确保表达式重新求值
        invalidateCache(varName, loopCtx)
        await execute(body, loopCtx)
      } finally {
        // 释放循环上下文回对象池
        releaseLoopContext(loopCtx)
      }
    }
  }
  // 遍历对象
  else if (typeof iterable === 'object' && iterable !== null) {
    const entries = Object.entries(iterable)
    for (let i = 0; i < entries.length; i++) {
      const [, value] = entries[i]
      // 使用对象池创建循环上下文
      const loopCtx = createLoopContext(ctx, value, i)
      loopCtx[varName] = value
      
      try {
        // 触发缓存失效，确保表达式重新求值
        invalidateCache(varName, loopCtx)
        await execute(body, loopCtx)
      } finally {
        // 释放循环上下文回对象池
        releaseLoopContext(loopCtx)
      }
    }
  }
  else {
    throw new ActionError(
      action,
      `loop "in" expression must evaluate to an array or object, got ${typeof iterable}`,
      ErrorCodes.ACTION_INVALID_PARAM,
      { metadata: { param: 'in', actualType: typeof iterable } }
    )
  }
}
