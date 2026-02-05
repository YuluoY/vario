/**
 * if 动作处理器
 * 
 * 功能：条件分支
 * 示例：{ "type": "if", "cond": "user.age > 18", "then": [...], "else": [...] }
 * 示例：{ "type": "if", "cond": "{{ counter < 10 }}", "then": [...], "else": [...] }
 */

import type { RuntimeContext, Action } from '@variojs/types'
import { ActionError, ErrorCodes } from '@/errors.js'
import { evaluate, extractExpression } from '@/expression/index.js'
import { execute } from '../executor.js'

/**
 * 处理 if 动作
 */
export async function handleIf(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  // 类型断言：确保 action 包含 if 动作的属性
  const { cond, then, else: elseBranch } = action as Action & { 
    cond?: string; 
    then?: Action[]; 
    else?: Action[] 
  }
  
  if (!cond || typeof cond !== 'string') {
    throw new ActionError(
      action,
      'if action requires "cond" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'cond' } }
    )
  }
  
  // 提取表达式（支持 {{ }} 格式）
  const condExpr = extractExpression(cond)
  
  // 求值条件表达式
  const condition = evaluate(condExpr, ctx)
  
  // 执行对应的分支
  if (condition) {
    if (then && Array.isArray(then)) {
      await execute(then, ctx)
    }
  } else {
    if (elseBranch && Array.isArray(elseBranch)) {
      await execute(elseBranch, ctx)
    }
  }
}
