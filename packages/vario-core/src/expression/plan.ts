export type { ExpressionPlan } from '@variojs/types'
export { compileExpressionPlan, compileExpressionPlanUncached } from './plan-compiler.js'
export { getCachedExpressionPlan, sharedPlanCache, getPlanCacheStats } from './plan-cache.js'
export { ResultMemo } from './result-memo.js'
