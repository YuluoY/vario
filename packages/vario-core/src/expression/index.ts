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
  lookupCachedExpression,
  invalidateCache,
  clearCache,
  getCacheStats
} from './cache.js'
export { getPolicyFingerprint, registerCapability, getCapability, listCapabilities } from './policy.js'
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
export { compileExpressionPlan, compileExpressionPlanUncached } from './plan-compiler.js'
export { getCachedExpressionPlan, sharedPlanCache, getPlanCacheStats } from './plan-cache.js'
export { ResultMemo } from './result-memo.js'
export { evaluateExpressionPlan } from './plan-evaluator.js'
