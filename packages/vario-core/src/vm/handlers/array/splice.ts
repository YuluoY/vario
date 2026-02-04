/**
 * splice 动作处理器
 * 
 * 功能：删除或替换数组元素
 * 示例：{ "type": "splice", "path": "items", "start": 0, "deleteCount": 1, "items": "{{ newItem }}" }
 */

import type { RuntimeContext, Action } from '@variojs/types'
import { ActionError, ErrorCodes } from '@/errors.js'
import { evaluate } from '@/expression/evaluate.js'
import { invalidateCache } from '@/expression/cache.js'
import { evaluateExpressionsRecursively } from './utils.js'

/**
 * 处理 splice 动作
 */
export async function handleSplice(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  const { path, start, deleteCount = 0, items } = action
  
  if (!path || typeof path !== 'string') {
    throw new ActionError(
      action,
      'splice action requires "path" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'path' } }
    )
  }
  
  // 获取数组
  const array = ctx._get(path)
  if (!Array.isArray(array)) {
    throw new ActionError(
      action,
      `Path "${path}" does not point to an array`,
      ErrorCodes.ACTION_INVALID_PARAM,
      { metadata: { param: 'path', path, actualType: typeof array } }
    )
  }
  
  // 求值 start（支持表达式）
  let finalStart: number
  if (typeof start === 'string' && start.startsWith('{{') && start.endsWith('}}')) {
    const expr = start.slice(2, -2).trim()
    finalStart = Number(evaluate(expr, ctx) as number)
  } else {
    finalStart = Number(start as number)
  }

  // 求值 deleteCount（支持表达式）
  let finalDeleteCount: number
  if (typeof deleteCount === 'string' && deleteCount.startsWith('{{') && deleteCount.endsWith('}}')) {
    const expr = deleteCount.slice(2, -2).trim()
    finalDeleteCount = Number(evaluate(expr, ctx) as number)
  } else {
    finalDeleteCount = Number(deleteCount as number)
  }
  
  // 求值 items（支持递归表达式）
  let finalItems: unknown[] = []
  if (items != null) {
    const evaluated = evaluateExpressionsRecursively(items, ctx)
    if (Array.isArray(evaluated)) {
      finalItems = evaluated
    } else {
      finalItems = [evaluated]
    }
  }
  
  // 执行 splice
  array.splice(finalStart, finalDeleteCount, ...finalItems)
  
  // 使相关缓存失效
  invalidateCache(path, ctx)
  invalidateCache(`${path}.*`, ctx)
}
