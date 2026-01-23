/**
 * log 动作处理器
 * 
 * 功能：调试输出
 * 示例：{ "type": "log", "level": "info", "message": "User logged in" }
 */

import type { RuntimeContext, Action } from '@/types.js'
import { ActionError, ErrorCodes } from '@/errors.js'
import { evaluate } from '@/expression/evaluate.js'

/**
 * 处理 log 动作
 */
export async function handleLog(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  const { level = 'info', message } = action
  
  if (!message) {
    throw new ActionError(
      action,
      'log action requires "message" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'message' } }
    )
  }
  
  // 求值 message（支持表达式）
  let finalMessage: unknown = message
  if (typeof message === 'string' && message.startsWith('{{') && message.endsWith('}}')) {
    const expr = message.slice(2, -2).trim()
    finalMessage = evaluate(expr, ctx)
  }
  
  // 输出日志（将 finalMessage 转换为字符串）
  const logLevel = String(level).toLowerCase()
  const messageStr = String(finalMessage)
  if (typeof console !== 'undefined') {
    switch (logLevel) {
      case 'error':
        console.error('[Vario]', messageStr)
        break
      case 'warn':
        console.warn('[Vario]', messageStr)
        break
      case 'info':
      default:
        console.log('[Vario]', messageStr)
        break
    }
  }
}
