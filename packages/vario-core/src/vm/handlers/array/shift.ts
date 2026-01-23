/**
 * shift 动作处理器
 * 
 * 功能：删除数组首元素
 * 示例：{ "type": "shift", "path": "items" }
 */

import type { RuntimeContext, Action } from '@/types.js'
import { ActionError, ErrorCodes } from '@/errors.js'
import { invalidateCache } from '@/expression/cache.js'

/**
 * 处理 shift 动作
 */
export async function handleShift(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  const { path } = action
  
  if (!path || typeof path !== 'string') {
    throw new ActionError(
      action,
      'shift action requires "path" parameter',
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
  
  // 删除首元素
  array.shift()
  
  // 使相关缓存失效
  invalidateCache(path, ctx)
  invalidateCache(`${path}.*`, ctx)
}
