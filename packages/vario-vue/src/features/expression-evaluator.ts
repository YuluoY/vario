/**
 * 表达式求值模块
 * 
 * 负责求值 Schema 中的表达式
 */

import type { RuntimeContext } from '@vario/core'
import { evaluate, extractExpression } from '@vario/core'

/**
 * 表达式求值器
 */
export class ExpressionEvaluator {
  /**
   * 求值表达式
   * 支持 {{ expression }} 格式，会自动去掉包装
   * 使用 core 中的 extractExpression 工具函数
   */
  evaluateExpr(expr: string, ctx: RuntimeContext): any {
    try {
      // 使用 core 中的工具函数提取表达式
      const finalExpr = extractExpression(expr)
      const result = evaluate(finalExpr, ctx)
      return result
    } catch (error) {
      return undefined
    }
  }
}
