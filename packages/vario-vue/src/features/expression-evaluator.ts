/**
 * 表达式求值模块
 *
 * 按显式 runtimeMode 分流（决策 2，禁止用"能否查到 PageSession"推断）：
 * - legacy / shadow → core evaluate()（per-ctx 旧缓存 + invalidateCache 双向前缀）
 * - prepared → evaluateExpressionPlan()（ResultMemo + ScopeFrame）
 */

import type { RuntimeContext } from '@variojs/types'
import {
  evaluate,
  extractExpression,
  compileExpressionPlan,
  evaluateExpressionPlan,
  ExpressionError,
  ErrorCodes
} from '@variojs/core'
import { getPageSessionForContext } from '../runtime/page-session.js'

export type VarioRuntimeMode = 'legacy' | 'shadow' | 'prepared'

/** 白名单告警去重：同一表达式只 warn 一次（FR-4 边界条件） */
const warned = new Set<string>()

/**
 * 表达式求值器
 */
export class ExpressionEvaluator {
  constructor(private runtimeMode: VarioRuntimeMode = 'legacy') {}

  /**
   * 求值表达式
   * 支持 {{ expression }} 格式，会自动去掉包装
   */
  evaluateExpr(expr: string, ctx: RuntimeContext): any {
    try {
      const finalExpr = extractExpression(expr)
      if (this.runtimeMode === 'prepared') {
        const session = getPageSessionForContext(ctx)
        if (session) {
          const frame = session.currentFrame()
          // 从当前 frame 的绑定名推导词法别名（itemKey/indexKey 等）：
          // 别名进入 localDeps 且参与 plan id，避免跨行命中 memo（KG-9 / T3.2）
          const plan = compileExpressionPlan(
            finalExpr,
            frame ? { aliases: Object.keys(frame.bindings) } : undefined
          )
          return evaluateExpressionPlan(plan, ctx, {
            memo: session.memo,
            frame,
            table: session.frames
          })
        }
      }
      return evaluate(finalExpr, ctx)
    } catch (error) {
      if (error instanceof RangeError) throw error
      if (
        error instanceof ExpressionError &&
        (error.code === ErrorCodes.EXPRESSION_VALIDATION_ERROR ||
          error.code === ErrorCodes.EXPRESSION_FUNCTION_NOT_WHITELISTED) &&
        !warned.has(expr)
      ) {
        warned.add(expr)
        console.warn('[Vario] expression rejected:', expr, error.message)
      }
      return undefined
    }
  }
}
