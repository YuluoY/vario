import { parseExpression } from './parser.js'
import { extractDependencies } from './dependencies.js'
import { getPolicyFingerprint, isPureAst } from './policy.js'
import { validateAST } from './whitelist.js'
import type { ExpressionPlan } from '@variojs/types'

const LOCAL_PREFIX = new Set(['item', 'index', '$item', '$index', 'row', 'cell'])
/** 命名空间根：依赖归 stateDeps 参与版本（失效走 onNamespacesChange → memo.bump） */
const NAMESPACE_ROOTS = new Set(['$variables', '$datasources', '$functions', '$utils'])
const PLAN_CACHE_MAX = 2000
const planCache = new Map<string, ExpressionPlan>()

export interface CompileExpressionPlanOptions {
  /** 祖先 loop 的词法别名（itemKey/indexKey），进入 localDeps 且参与 plan id */
  aliases?: readonly string[]
}

export function getCachedExpressionPlan(source: string, options?: CompileExpressionPlanOptions): ExpressionPlan {
  const fingerprint = getPolicyFingerprint()
  const aliases = options?.aliases ?? []
  const aliasToken = aliases.length > 0 ? `::a[${aliases.slice().sort().join(',')}]` : ''
  const key = `${fingerprint}${aliasToken}::${source}`
  const hit = planCache.get(key)
  if (hit) {
    planCache.delete(key)
    planCache.set(key, hit)
    return hit
  }
  const plan = compileExpressionPlanUncached(source, options)
  if (planCache.size >= PLAN_CACHE_MAX) {
    const oldest = planCache.keys().next().value
    if (oldest !== undefined) planCache.delete(oldest)
  }
  planCache.set(key, plan)
  return plan
}

export function compileExpressionPlan(source: string, options?: CompileExpressionPlanOptions): ExpressionPlan {
  return getCachedExpressionPlan(source, options)
}

export function compileExpressionPlanUncached(source: string, options?: CompileExpressionPlanOptions): ExpressionPlan {
  const aliases = options?.aliases ?? []
  const localRoots = new Set<string>([...LOCAL_PREFIX, ...aliases])
  const isNamespaceDep = (d: string): boolean => NAMESPACE_ROOTS.has(d.split('.')[0])
  const ast = parseExpression(source)
  validateAST(ast)
  const deps = extractDependencies(ast)
  const stateDeps = deps.filter(d => (!localRoots.has(d.split('.')[0]) && !d.startsWith('$')) || isNamespaceDep(d))
  const localDeps = deps.filter(d => localRoots.has(d.split('.')[0]))
  const dynamicDeps = deps.filter(d => d.includes('.*') || (d.startsWith('$') && !isNamespaceDep(d)))
  const fingerprint = getPolicyFingerprint()
  const aliasToken = aliases.length > 0 ? `::a[${aliases.slice().sort().join(',')}]` : ''
  const cost = Math.min(64, 1 + deps.length)
  const dependencyMode = dynamicDeps.length > 0 ? 'dynamic' : localDeps.length > 0 ? 'prefix' : 'exact'
  return Object.freeze({
    id: `${fingerprint}${aliasToken}::${source}`,
    source,
    ast,
    stateDeps: Object.freeze(stateDeps),
    localDeps: Object.freeze(localDeps),
    dynamicDeps: Object.freeze(dynamicDeps),
    dependencyMode,
    pure: isPureAst(ast),
    cost,
    estimatedCost: cost,
    policyFingerprint: fingerprint,
    aliases: Object.freeze([...aliases])
  })
}
