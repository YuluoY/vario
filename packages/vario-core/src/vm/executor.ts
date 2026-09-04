/**
 * Action VM 执行器
 *
 * execute() 只创建一次 ExecutionSession；嵌套 if/loop/batch 共享
 * absolute deadline、remainingSteps、signal、executionId。
 */

import type { RuntimeContext, Action, MethodHandler } from '@variojs/types'
import { ActionError, ServiceError, BatchError, ErrorCodes, VarioError } from '../errors.js'
import {
  createExecutionSession,
  bindExecutionSession,
  unbindExecutionSession,
  getExecutionSession,
  type ExecutionSession,
} from './execution-session.js'
import { getBuiltinHandler } from './handlers/index.js'
import { isContextDisposed } from '../runtime/runtime-session.js'
import { isOwnerPaused } from '../state/index.js'
import type { DiagnosticSink } from '../diagnostics/diagnostic-sink.js'

export interface ExecuteOptions {
  timeout?: number
  maxSteps?: number
  signal?: AbortSignal
  diagnosticSink?: DiagnosticSink
}

const BLOCKED_HANDLER_NAMES = new Set([
  'constructor',
  'toString',
  '__proto__',
  'prototype',
  'hasOwnProperty',
  'valueOf',
])

export function lookupOwnHandler(
  methods: Record<string, MethodHandler> | undefined,
  type: string
): MethodHandler | undefined {
  if (!methods || BLOCKED_HANDLER_NAMES.has(type)) return undefined
  if (!Object.prototype.hasOwnProperty.call(methods, type)) return undefined
  const handler = methods[type]
  return typeof handler === 'function' ? handler : undefined
}

export async function execute(
  actions: Action[],
  ctx: RuntimeContext,
  options: ExecuteOptions = {}
): Promise<void> {
  if (isContextDisposed(ctx)) {
    throw new VarioError('Session disposed', ErrorCodes.SESSION_DISPOSED)
  }
  if (isOwnerPaused(ctx)) {
    options.diagnosticSink?.emit({
      name: 'action-skip',
      diagnostic: {
        code: ErrorCodes.SESSION_PAUSED,
        message: 'execute skipped: owner paused',
        path: '',
        phase: 'action',
      },
    })
    return
  }
  const existing = getExecutionSession(ctx)
  if (existing && existing.active && !existing.cancelled) {
    await runActions(actions, ctx, existing)
    return
  }
  if (existing) unbindExecutionSession(ctx)

  const timeout = options.timeout ?? 5000
  const maxSteps = options.maxSteps ?? 10000
  const session = createExecutionSession({ timeout, maxSteps, diagnosticSink: options.diagnosticSink })
  bindExecutionSession(ctx, session)

  if (options.signal) {
    if (options.signal.aborted) {
      session.cancel('abort')
    } else {
      options.signal.addEventListener('abort', () => session.cancel('abort'), { once: true })
    }
  }

  try {
    await runActions(actions, ctx, session)
  } finally {
    session.dispose()
    unbindExecutionSession(ctx)
  }
}

export async function runChild(
  actions: Action[],
  ctx: RuntimeContext
): Promise<void> {
  const session = getExecutionSession(ctx)
  if (!session) {
    await execute(actions, ctx)
    return
  }
  await runActions(actions, ctx, session)
}

async function runActions(
  actions: Action[],
  ctx: RuntimeContext,
  session: ExecutionSession
): Promise<void> {
  for (const action of actions) {
    session.throwIfCancelled(action)
    session.consumeStep(action)
    session.callStack.push(action)
    emitAction(session, 'action-start', action)

    const handler = lookupOwnHandler(ctx.$methods, action.type) ?? getBuiltinHandler(action.type)

    if (!handler) {
      session.callStack.pop()
      emitAction(session, 'action-error', action)
      throw new ActionError(
        action,
        `Unknown action type: ${action.type}. Make sure the action is registered in $methods`,
        ErrorCodes.ACTION_UNKNOWN_TYPE
      )
    }

    try {
      const result = handler.length >= 3
        ? (handler as MethodHandler)(ctx, action, session.metadata)
        : handler(ctx, action)

      if (result && typeof (result as Promise<unknown>).then === 'function') {
        session.throwIfCancelled(action)
        await abortable(result as Promise<unknown>, session, action)
        session.throwIfCancelled(action)
      }
      emitAction(session, 'action-end', action)
    } catch (error: unknown) {
      if (error instanceof ActionError) {
        emitAction(
          session,
          error.code === ErrorCodes.ACTION_ABORTED || error.code === ErrorCodes.ACTION_TIMEOUT
            ? 'action-cancel'
            : 'action-error',
          action
        )
        throw error
      }
      if (error instanceof ServiceError) {
        emitAction(session, 'action-error', action)
        throw error
      }
      if (error instanceof BatchError) {
        emitAction(session, 'action-rollback', action)
        throw error
      }

      emitAction(session, 'action-error', action)
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new ActionError(
        action,
        `Action execution failed: ${errorMessage}`,
        ErrorCodes.ACTION_EXECUTION_ERROR,
        {
          metadata: {
            originalError: error instanceof Error ? error.name : 'Unknown',
            stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
            executionId: session.executionId,
          }
        }
      )
    } finally {
      session.callStack.pop()
    }
  }
}

function emitAction(session: ExecutionSession, name: string, action: Action): void {
  const actionId = 'id' in action && typeof (action as { id?: unknown }).id === 'string'
    ? (action as { id: string }).id
    : action.type
  session.sink?.emit({
    name,
    executionId: session.executionId,
    actionId,
    diagnostic: {
      code: action.type,
      message: name,
      path: '',
      phase: 'action',
      actionId
    }
  })
}

function abortable(
  promise: Promise<unknown>,
  session: ExecutionSession,
  action: Action
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false
    const onAbort = () => {
      // 延迟一个宏任务再以取消错误拒绝：给 handler 自身的失败路径
      // （如 batch 回滚后的 BatchError）先浮出的机会（FR-14）。
      setTimeout(() => {
        if (settled) return
        try {
          session.throwIfCancelled(action)
        } catch (error) {
          reject(error)
        }
      }, 0)
    }
    if (!session.canWrite()) {
      onAbort()
      return
    }
    session.signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        settled = true
        session.signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        settled = true
        session.signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}
