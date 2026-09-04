/**
 * loop 动作处理器
 *
 * 功能：循环执行；每次迭代共享父 ExecutionSession（deadline/steps/signal）。
 * 示例：{ "type": "loop", "var": "item", "in": "items", "body": [...] }
 */

import type { RuntimeContext, Action } from '@variojs/types'
import { ActionError, ErrorCodes } from '@/errors.js'
import { evaluate } from '@/expression/evaluate.js'
import { invalidateCache } from '@/expression/cache.js'
import { runChild } from '../executor.js'
import { createLoopContext, releaseLoopContext } from '@/runtime/loop-context-pool.js'
import { bindExecutionSession, unbindExecutionSession, getExecutionSession } from '../execution-session.js'

/**
 * 处理 loop 动作
 */
export async function handleLoop(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  // 类型断言：确保 action 包含 loop 动作的属性
  const { var: varName, in: inExpr, body } = action as Action & { var?: string; in?: string; body?: Action[] }

  if (!varName || typeof varName !== 'string') {
    throw new ActionError(
      action,
      'loop action requires "var" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'var' } }
    )
  }

  if (!inExpr || typeof inExpr !== 'string') {
    throw new ActionError(
      action,
      'loop action requires "in" parameter',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'in' } }
    )
  }

  if (!body || !Array.isArray(body)) {
    throw new ActionError(
      action,
      'loop action requires "body" parameter (array of actions)',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'body' } }
    )
  }

  // 求值 in 表达式，获取要遍历的数组或对象
  const iterable = evaluate(inExpr, ctx)

  if (iterable == null) {
    return
  }

  // 迭代前取出父会话：所有迭代共享 deadline/steps/signal（FR-1）
  const session = getExecutionSession(ctx)

  const runIteration = async (value: unknown, i: number): Promise<void> => {
    session?.throwIfCancelled(action)
    if (session) {
      session.remainingSteps -= 1
      if (session.remainingSteps < 0) {
        throw new ActionError(
          action,
          'Action execution exceeded max steps',
          ErrorCodes.ACTION_MAX_STEPS_EXCEEDED
        )
      }
    }
    if (i > 0 && i % 32 === 0) {
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      session?.throwIfCancelled(action)
    }

    const loopCtx = createLoopContext(ctx, value, i)
    loopCtx[varName] = value
    if (session) bindExecutionSession(loopCtx, session)

    try {
      invalidateCache(varName, loopCtx)
      await runChild(body, loopCtx)
    } finally {
      if (session) unbindExecutionSession(loopCtx)
      releaseLoopContext(loopCtx)
    }
  }

  // 遍历数组
  if (Array.isArray(iterable)) {
    for (let i = 0; i < iterable.length; i++) {
      await runIteration(iterable[i], i)
    }
  }
  // 遍历对象
  else if (typeof iterable === 'object' && iterable !== null) {
    const entries = Object.entries(iterable)
    for (let i = 0; i < entries.length; i++) {
      const [, value] = entries[i]
      await runIteration(value, i)
    }
  }
  else {
    throw new ActionError(
      action,
      `loop "in" expression must evaluate to an array or object, got ${typeof iterable}`,
      ErrorCodes.ACTION_INVALID_PARAM,
      { metadata: { param: 'in', actualType: typeof iterable } }
    )
  }
}
