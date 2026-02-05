/**
 * navigate 动作处理器
 * 
 * 功能：路由导航
 * 示例：{ "type": "navigate", "to": "/users/123" }
 */

import type { RuntimeContext, Action } from '@variojs/types'
import { ActionError, ErrorCodes } from '@/errors.js'
import { evaluate } from '@/expression/evaluate.js'

/**
 * 处理 navigate 动作
 */
export async function handleNavigate(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  // 类型断言：确保 action 包含 navigate 动作的属性
  const { to } = action as Action & { to?: string }
  
  if (!to || typeof to !== 'string') {
    throw new ActionError(
      action,
      'navigate action requires "to" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'to' } }
    )
  }
  
  // 求值 to（支持表达式）
  let finalTo: string = to
  if (to.startsWith('{{') && to.endsWith('}}')) {
    const expr = to.slice(2, -2).trim()
    const result = evaluate(expr, ctx)
    if (typeof result !== 'string') {
      throw new ActionError(
        action,
        `navigate "to" expression must evaluate to a string, got ${typeof result}`,
        ErrorCodes.ACTION_INVALID_PARAM,
        { metadata: { param: 'to', actualType: typeof result } }
      )
    }
    finalTo = result
  }
  
  // 调用路由导航方法（如果已注册）
  const navigateHandler = ctx.$methods['navigate'] || ctx.$methods['$navigate']
  if (navigateHandler) {
    await navigateHandler(ctx, { to: finalTo })
  } else {
    // 如果没有注册导航方法，使用默认行为（浏览器导航）
    // 使用类型安全的 window 访问
    if (typeof window !== 'undefined' && (window as { location?: { href: string } }).location) {
      ((window as unknown) as { location: { href: string } }).location.href = finalTo
    } else {
      throw new ActionError(
        action,
        'navigate method not registered and window.location is not available',
        ErrorCodes.ACTION_EXECUTION_ERROR,
        { metadata: { reason: 'navigate_not_available' } }
      )
    }
  }
}
