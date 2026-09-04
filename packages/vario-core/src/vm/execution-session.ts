/**
 * ExecutionSession：一次用户事件共享 deadline / remainingSteps / signal / executionId。
 *
 * 生命周期（FR-1）：
 * - execute() 的 finally 必须解绑 ctx → session 绑定（unbindExecutionSession）。
 * - 复用仅对"仍在运行且未 cancel"的 session 生效（active 标志）。
 * - loop 迭代的 loopCtx 显式绑定到父 session，迭代结束解绑。
 */

import type { Action, RuntimeContext } from '@variojs/types'
import { ActionError, ErrorCodes, VarioError } from '../errors.js'
import type { DiagnosticSink } from '../diagnostics/diagnostic-sink.js'
import { noopDiagnosticSink } from '../diagnostics/diagnostic-sink.js'
import { createScopeFrame, type ScopeFrame } from '../scope/scope-frame.js'
import { isContextDisposed } from '../runtime/runtime-session.js'
import { getParentContext } from '../runtime/forwarding-context.js'

const CONTROL_FLOW_TYPES = new Set(['if', 'loop', 'batch'])

const sessions = new WeakMap<object, ExecutionSession>()

export interface ExecutionMetadata {
  readonly signal: AbortSignal
  readonly executionId: string
  readonly deadline: number
}

export interface JournalEntry {
  readonly path: string
  readonly oldValue: unknown
}

export interface MutationJournal {
  committed: boolean
  rolledBack: boolean
  readonly entries: readonly JournalEntry[]
  record(path: string, oldValue: unknown): void
  commit(): void
  rollback(): void
}

export class ExecutionSession {
  readonly id: string
  readonly executionId: string
  readonly deadline: number
  remainingSteps: number
  readonly signal: AbortSignal
  readonly metadata: ExecutionMetadata
  readonly scope: ScopeFrame
  readonly diagnostics: DiagnosticSink
  /** execute 退出后置 false；false 的会话不再被复用 */
  active = true
  cancelled = false
  cancelReason: 'timeout' | 'abort' | null = null
  readonly sink?: DiagnosticSink
  journal: MutationJournal | null = null
  readonly callStack: Action[] = []
  private readonly controller: AbortController
  private timeoutId: ReturnType<typeof setTimeout> | null

  constructor(options: { timeout: number; maxSteps: number; diagnosticSink?: DiagnosticSink }) {
    this.executionId = `exec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    this.id = this.executionId
    this.deadline = Date.now() + options.timeout
    this.remainingSteps = options.maxSteps
    this.sink = options.diagnosticSink
    this.diagnostics = options.diagnosticSink ?? noopDiagnosticSink
    this.scope = createScopeFrame(null, {})
    this.controller = new AbortController()
    this.signal = this.controller.signal
    this.metadata = { signal: this.signal, executionId: this.executionId, deadline: this.deadline }
    this.timeoutId = setTimeout(() => this.cancel('timeout'), options.timeout)
  }

  consumeStep(action: Action): void {
    this.throwIfCancelled()
    if (CONTROL_FLOW_TYPES.has(action.type)) return
    this.remainingSteps -= 1
    if (this.remainingSteps < 0) {
      throw new ActionError(
        action,
        `Action execution exceeded max steps`,
        ErrorCodes.ACTION_MAX_STEPS_EXCEEDED,
        {
          metadata: {
            executionId: this.executionId,
            remainingSteps: this.remainingSteps,
          },
        }
      )
    }
  }

  canWrite(): boolean {
    if (this.cancelled || this.signal.aborted) return false
    if (Date.now() > this.deadline) {
      this.cancel('timeout')
      return false
    }
    return true
  }

  throwIfCancelled(action?: Action): void {
    if (this.canWrite()) return
    const dummy = action ?? ({ type: 'unknown' } as Action)
    if (this.cancelReason === 'timeout' || Date.now() > this.deadline) {
      throw new ActionError(
        dummy,
        'Action execution exceeded timeout',
        ErrorCodes.ACTION_TIMEOUT,
        { metadata: { executionId: this.executionId, deadline: this.deadline } }
      )
    }
    throw new ActionError(
      dummy,
      'Action execution was aborted',
      ErrorCodes.ACTION_ABORTED,
      { metadata: { executionId: this.executionId } }
    )
  }

  cancel(reason: 'timeout' | 'abort' = 'abort'): void {
    this.cancelled = true
    this.cancelReason = reason
    if (!this.controller.signal.aborted) {
      this.controller.abort()
    }
    this.clearTimer()
  }

  /**
   * journal 记录 batch 内每次 _set 的 (path, oldValue)，失败时逆序恢复。
   */
  beginJournal(): MutationJournal {
    const entries: JournalEntry[] = []
    const journal: MutationJournal = {
      committed: false,
      rolledBack: false,
      entries,
      record(path, oldValue) {
        if (this.committed || this.rolledBack) return
        entries.push({ path, oldValue })
      },
      commit() {
        this.committed = true
      },
      rollback() {
        this.rolledBack = true
      }
    }
    this.journal = journal
    return journal
  }

  dispose(): void {
    this.clearTimer()
    this.active = false
  }

  private clearTimer(): void {
    if (this.timeoutId != null) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}

export function createExecutionSession(options: { timeout: number; maxSteps: number; diagnosticSink?: DiagnosticSink }): ExecutionSession {
  return new ExecutionSession(options)
}

export function bindExecutionSession(ctx: object, session: ExecutionSession): void {
  sessions.set(ctx, session)
}

/** 解除 ctx → session 绑定；execute/loop 迭代结束时调用 */
export function unbindExecutionSession(ctx: object): void {
  sessions.delete(ctx)
}

export function getExecutionSession(ctx: object | null | undefined): ExecutionSession | undefined {
  let current: object | null = ctx ?? null
  let depth = 0
  while (current && current !== Object.prototype && depth < 64) {
    depth++
    const found = sessions.get(current)
    if (found) {
      if (!found.active || found.cancelled) {
        // 过期/取消的会话顺手解绑，避免永久残留（KG-1）
        sessions.delete(current)
        return undefined
      }
      return found
    }
    const proto = Object.getPrototypeOf(current)
    if (proto && proto !== Object.prototype) {
      current = proto
    } else {
      // 原型链到底：loop/scope 转发 ctx 的 getPrototypeOf 固定为 Object.prototype，
      // 通过 parents 登记回落父 ctx 继续查找
      current = getParentContext(current) ?? null
      if (current === ctx) break
    }
  }
  return undefined
}

export function assertSessionCanWrite(ctx: RuntimeContext): void {
  if (isContextDisposed(ctx)) {
    throw new VarioError('Session disposed', ErrorCodes.SESSION_DISPOSED)
  }
  const session = getExecutionSession(ctx)
  if (session) session.throwIfCancelled()
}
