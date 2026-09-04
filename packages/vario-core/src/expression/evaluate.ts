/**
 * 表达式求值入口函数
 *
 * 整合解析、验证、缓存、求值流程
 */

import type { RuntimeContext, ExpressionOptions } from '@variojs/types'
import { ExpressionError, ErrorCodes } from '../errors.js'
import { parseExpression } from './parser.js'
import { extractExpression } from './utils.js'
import { validateAST } from './whitelist.js'
import { evaluateExpression } from './evaluator.js'
import { extractDependencies } from './dependencies.js'
import { getCompiledExpression } from './compiler.js'
import {
  lookupCachedExpression,
  setCachedExpression,
} from './cache.js'
import { getPolicyFingerprint, isPureAst } from './policy.js'

const LEXICAL_ROOTS = new Set(['item', 'index', '$item', '$index', 'row', 'cell'])
/** 每次事件/每个节点取当前值的特殊变量：表达式一律不缓存（FR-3） */
const SPECIAL_VAR_ROOTS = new Set(['$event', '$self', '$parent', '$siblings', '$children'])

function hasLexicalRoot(source: string): boolean {
  return /(?:^|[^.\w])(?:item|index|\$item|\$index|row|cell|\$event|\$self|\$parent|\$siblings|\$children)(?:[.[]|$)/.test(source)
}

export function evaluate(
  expr: string,
  ctx: RuntimeContext,
  options: ExpressionOptions = {}
): unknown {
  try {
    const mergedOptions = {
      ...ctx.$exprOptions,
      ...options
    }
    const source = extractExpression(expr)
    const fingerprint = getPolicyFingerprint(mergedOptions)
    const lexical = hasLexicalRoot(source)

    if (!lexical) {
      const cached = lookupCachedExpression(source, ctx, fingerprint)
      if (cached.hit) {
        return cached.value
      }
    }

    const ast = parseExpression(source)

    validateAST(ast, {
      allowGlobals: mergedOptions.allowGlobals,
      maxNestingDepth: mergedOptions.maxNestingDepth
    })

    const compiled = getCompiledExpression(source, ast)
    const result = compiled
      ? compiled(ctx)
      : evaluateExpression(ast, ctx, mergedOptions)

    const dependencies = extractDependencies(ast)
    const cacheable = result === null || typeof result !== 'object'
    if (!lexical && cacheable && isPureAst(ast) && !dependencies.some(d => LEXICAL_ROOTS.has(d.split('.')[0]) || SPECIAL_VAR_ROOTS.has(d.split('.')[0]))) {
      setCachedExpression(source, result, dependencies, ctx, fingerprint)
    }

    return result
  } catch (error: unknown) {
    if (error instanceof RangeError) throw error
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
