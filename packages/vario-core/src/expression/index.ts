/**
 * Expression 模块导出
 */

export { parseExpression } from './parser.js'
export { validateAST } from './whitelist.js'
export { evaluateExpression } from './evaluator.js'
export { evaluate } from './evaluate.js'
export { extractDependencies } from './dependencies.js'
export {
  getCachedExpression,
  setCachedExpression,
  invalidateCache,
  clearCache
} from './cache.js'
export {
  extractExpression,
  normalizeExpression,
  isExpressionFormat,
  extractExpressionsRecursively
} from './utils.js'
export {
  compileSimpleExpression,
  getCompiledExpression,
  clearCompiledCache,
  type CompiledExpression
} from './compiler.js'
