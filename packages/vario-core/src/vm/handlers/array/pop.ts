/**
 * pop 动作处理器
 * 
 * 功能：删除数组末尾元素
 * 示例：{ "type": "pop", "path": "items" }
 */

import type { RuntimeContext, Action } from '@variojs/types'
import { ActionError, ErrorCodes } from '@/errors.js'
import { invalidateCache } from '@/expression/cache.js'

/**
 * 处理 pop 动作
 */
export async function handlePop(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  // 类型断言：确保 action 包含 pop 动作的属性
  const { path } = action as Action & { path?: string }
  
  if (!path || typeof path !== 'string') {
    throw new ActionError(
      action,
      'pop action requires "path" parameter',
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
  
  // 删除末尾元素
  array.pop()
  
  // 使相关缓存失效
  invalidateCache(path, ctx)
  invalidateCache(`${path}.*`, ctx)
}
