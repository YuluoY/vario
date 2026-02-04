/**
 * set 动作处理器
 * 
 * 功能：修改状态
 * 示例：{ "type": "set", "path": "user.name", "value": "张三" }
 * 
 * 注意：缓存失效通过 RuntimeContext 的 onStateChange 钩子处理
 * 框架集成层应在创建上下文时注册该钩子
 */

import type { RuntimeContext, Action } from '@variojs/types'
import { ActionError, ErrorCodes } from '@/errors.js'
import { evaluate } from '@/expression/evaluate.js'

/**
 * 处理 set 动作
 */
export async function handleSet(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  const { path, value } = action
  
  if (!path || typeof path !== 'string') {
    throw new ActionError(
      action,
      'set action requires "path" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'path' } }
    )
  }
  
  // 求值 value（支持表达式）
  let finalValue = value
  if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
    // 表达式插值：{{ user.age + 1 }}
    const expr = value.slice(2, -2).trim()
    finalValue = evaluate(expr, ctx)
  }
  
  // 设置状态（缓存失效通过 onStateChange 钩子自动处理）
  ctx._set(path, finalValue)
}
