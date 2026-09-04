/**
 * batch 动作处理器
 *
 * 失败后按 journal 记录的 (path, oldValue) 逆序恢复；
 * 回滚写入绕过 assertSessionCanWrite，并在 endChangeTransaction 之前完成；
 * BatchError 不被二次包装。
 */

import type { RuntimeContext, Action } from '@variojs/types'
import { ActionError, BatchError, ErrorCodes } from '@/errors.js'
import { runChild } from '../executor.js'
import { beginChangeTransaction, endChangeTransaction } from '../../runtime/change-set.js'
import { getExecutionSession } from '../execution-session.js'

export async function handleBatch(
  ctx: RuntimeContext,
  action: Action
): Promise<void> {
  const { actions } = action as Action & { actions?: Action[] }

  if (!actions || !Array.isArray(actions)) {
    throw new ActionError(
      action,
      'batch action requires "actions" parameter (array)',
      ErrorCodes.ACTION_MISSING_PARAM,
      { metadata: { param: 'actions' } }
    )
  }

  const errors: Array<{ action: Action; error: Error }> = []
  const session = getExecutionSession(ctx)
  const journal = session?.beginJournal()

  beginChangeTransaction(ctx)
  try {
    for (const act of actions) {
      try {
        await runChild([act], ctx)
      } catch (error: unknown) {
        errors.push({
          action: act,
          error: error instanceof Error ? error : new Error(String(error))
        })
      }
    }
    if (errors.length > 0) {
      // 逆序恢复 batch 内每次 _set 记录的旧值；
      // bypassSession：session 可能已 timeout/abort，回滚不能被 assertSessionCanWrite 拦截
      const entries = journal ? [...journal.entries].reverse() : []
      for (const entry of entries) {
        try {
          ctx._set(entry.path, entry.oldValue as never, { skipCallback: true, bypassSession: true })
        } catch {
          // 单条回滚失败不阻断后续条目
        }
      }
      journal?.rollback()
    }
  } finally {
    endChangeTransaction(ctx)
  }

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
  journal?.commit()
}
