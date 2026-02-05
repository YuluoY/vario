/**
 * push 动作处理器
 * 
 * 功能：添加元素到数组末尾
 * 示例：{ "type": "push", "path": "items", "value": "{{ newItem }}" }
 * 示例：{ "type": "push", "path": "todos", "items": [{ text: "{{ newTodo }}", done: false }] }
 */

import type { RuntimeContext, Action } from '@variojs/types'
import { ActionError, ErrorCodes } from '@/errors.js'
import { invalidateCache } from '@/expression/cache.js'
import { evaluateExpressionsRecursively } from './utils.js'

/**
 * 处理 push 动作
 */
export async function handlePush(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  // 类型断言：确保 action 包含 push 动作的属性
  const { path, value, items } = action as Action & { path?: string; value?: unknown; items?: unknown[] }
  
  if (!path || typeof path !== 'string') {
    throw new ActionError(
      action,
      'push action requires "path" parameter',
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
  
  // 支持 items 作为 value 的别名
  const inputValue = items !== undefined ? items : value
  
  if (inputValue === undefined) {
    throw new ActionError(
      action,
      'push action requires "value" or "items" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'value|items' } }
    )
  }
  
  // 递归求值表达式（支持对象/数组中的表达式）
  const finalValue = evaluateExpressionsRecursively(inputValue, ctx)
  
  // 如果是数组，展开添加
  if (Array.isArray(finalValue)) {
    array.push(...finalValue)
  } else {
    array.push(finalValue)
  }
  
  // 使相关缓存失效
  invalidateCache(path, ctx)
  invalidateCache(`${path}.*`, ctx)
}
