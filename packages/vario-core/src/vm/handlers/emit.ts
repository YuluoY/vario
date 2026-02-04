/**
 * emit 动作处理器
 * 
 * 功能：触发事件
 * 示例：{ "type": "emit", "event": "submit", "data": { "userId": 123 } }
 */

import type { RuntimeContext, Action } from '@variojs/types'
import { ActionError, ErrorCodes } from '@/errors.js'
import { evaluate } from '@/expression/evaluate.js'

/**
 * 处理 emit 动作
 */
export async function handleEmit(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  const { event, data } = action
  
  if (!event || typeof event !== 'string') {
    throw new ActionError(
      action,
      'emit action requires "event" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'event' } }
    )
  }
  
  // 求值 data（支持表达式）
  let finalData = data
  if (typeof data === 'string' && data.startsWith('{{') && data.endsWith('}}')) {
    const expr = data.slice(2, -2).trim()
    finalData = evaluate(expr, ctx)
  }
  
  // 触发事件
  ctx.$emit(event, finalData)
}
