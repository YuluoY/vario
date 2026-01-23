/**
 * 表达式解析器
 * 
 * 使用 @babel/parser 解析 JavaScript 表达式为 AST
 * 移除 models. 前缀支持
 */

import { parse } from '@babel/parser'
import type * as ESTree from '@babel/types'
import { ExpressionError, ErrorCodes } from '../errors.js'

/**
 * 解析表达式为 AST
 * 
 * @param expr 表达式字符串（如 "user.name + 1"）
 * @returns ESTree.Node AST 节点
 */
export function parseExpression(expr: string): ESTree.Node {
  try {
    // 解析为表达式（ExpressionStatement）
    const ast = parse(`(${expr})`, {
      plugins: ['typescript'],
      sourceType: 'module',
      allowReturnOutsideFunction: true,
    })
    
    // 提取表达式部分
    const statement = ast.program.body[0]
    if (statement?.type === 'ExpressionStatement') {
      return statement.expression
    }
    
    throw new ExpressionError(
      expr,
      `Failed to parse expression: ${expr}`,
      ErrorCodes.EXPRESSION_PARSE_ERROR
    )
  } catch (error: unknown) {
    if (error instanceof ExpressionError) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new ExpressionError(
      expr,
      `Expression parse error: ${errorMessage}`,
      ErrorCodes.EXPRESSION_PARSE_ERROR,
      {
        metadata: {
          originalError: error instanceof Error ? error.name : 'Unknown'
        }
      }
    )
  }
}
