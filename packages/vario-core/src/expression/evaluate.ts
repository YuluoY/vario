/**
 * 表达式求值入口函数
 * 
 * 整合解析、验证、缓存、求值流程
 */

import type { RuntimeContext, ExpressionOptions } from '../types.js'
import { ExpressionError, ErrorCodes } from '../errors.js'
import { parseExpression } from './parser.js'
import { validateAST } from './whitelist.js'
import { evaluateExpression } from './evaluator.js'
import { extractDependencies } from './dependencies.js'
import { getCompiledExpression } from './compiler.js'
import {
  getCachedExpression,
  setCachedExpression,
} from './cache.js'

/**
 * 求值表达式（完整流程）
 * 
 * @param expr 表达式字符串
 * @param ctx 运行时上下文
 * @returns 求值结果（类型无法静态推导，返回 unknown）
 * 
 * 注意：表达式求值结果类型无法在编译时确定，因为：
 * 1. 表达式是运行时字符串
 * 2. 状态类型是动态的
 * 3. 表达式可能返回任意类型
 * 
 * 如果需要类型安全，应在使用结果时进行类型守卫或类型断言
 */
export function evaluate(
  expr: string,
  ctx: RuntimeContext,
  options: ExpressionOptions = {}
): unknown {
  try {
    // 合并选项：ctx.$exprOptions 优先级低于直接传入的 options
    const mergedOptions = {
      ...ctx.$exprOptions,
      ...options
    }
    
    // 1. 检查结果缓存
    const cached = getCachedExpression(expr, ctx)
    if (cached !== null) {
      return cached
    }
    
    // 2. 解析为 AST
    const ast = parseExpression(expr)
    
    // 3. AST 白名单校验（传递 allowGlobals 和 maxNestingDepth 选项）
    validateAST(ast, { 
      allowGlobals: mergedOptions.allowGlobals,
      maxNestingDepth: mergedOptions.maxNestingDepth
    })
    
    // 4. 尝试使用编译缓存（简单表达式）
    const compiled = getCompiledExpression(expr, ast)
    if (compiled) {
      const result = compiled(ctx)
      // 提取依赖并缓存结果
      const dependencies = extractDependencies(ast)
      setCachedExpression(expr, result, dependencies, ctx)
      return result
    }
    
    // 5. 复杂表达式，使用解释执行
    const result = evaluateExpression(ast, ctx, mergedOptions)
    
    // 6. 提取依赖并缓存
    const dependencies = extractDependencies(ast)
    setCachedExpression(expr, result, dependencies, ctx)
    
    return result
  } catch (error: unknown) {
    if (error instanceof ExpressionError) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new ExpressionError(
      expr,
      `Expression evaluation failed: ${errorMessage}`,
      ErrorCodes.EXPRESSION_EVALUATION_ERROR,
      {
        metadata: {
          originalError: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
        }
      }
    )
  }
}
