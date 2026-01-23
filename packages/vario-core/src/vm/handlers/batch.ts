/**
 * batch 动作处理器
 * 
 * 功能：批量执行动作（保证原子性）
 * 示例：{ "type": "batch", "actions": [...] }
 */

import type { RuntimeContext, Action } from '@/types.js'
import { ActionError, BatchError, ErrorCodes } from '@/errors.js'
import { execute } from '../executor.js'

/**
 * 处理 batch 动作
 */
export async function handleBatch(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  const { actions } = action
  
  if (!actions || !Array.isArray(actions)) {
    throw new ActionError(
      action,
      'batch action requires "actions" parameter (array)',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'actions' } }
    )
  }
  
  const errors: Array<{ action: Action; error: Error }> = []
  
  // 批量执行，收集错误
  for (const act of actions) {
    try {
      await execute([act], ctx)
    } catch (error: unknown) {
      errors.push({
        action: act,
        error: error instanceof Error ? error : new Error(String(error))
      })
    }
  }
  
  // 如果有错误，抛出 BatchError
  if (errors.length > 0) {
    throw new BatchError(
      errors,
      `${errors.length} actions failed in batch`,
      {
        metadata: {
          failedCount: errors.length,
          totalCount: actions.length
        }
      }
    )
  }
}
