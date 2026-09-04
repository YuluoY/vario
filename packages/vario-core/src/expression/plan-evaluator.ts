import type { ExpressionPlan, RuntimeContext } from '@variojs/types'
import type * as ESTree from '@babel/types'
import { evaluateExpression } from './evaluator.js'
import { getCompiledExpression } from './compiler.js'
import { validateAST } from './whitelist.js'
import { ResultMemo } from './result-memo.js'
import { lookupBinding, type ScopeFrame, type ScopeTable } from '../scope/scope-frame.js'

function runPreparedPlan(plan: ExpressionPlan, ctx: RuntimeContext): unknown {
  const ast = plan.ast as ESTree.Node
  validateAST(ast, {
    allowGlobals: ctx.$exprOptions?.allowGlobals,
    maxNestingDepth: ctx.$exprOptions?.maxNestingDepth
  })
  const compiled = getCompiledExpression(plan.source, ast)
  return compiled ? compiled(ctx) : evaluateExpression(ast, ctx)
}

export function evaluateExpressionPlan(
  plan: ExpressionPlan,
  ctx: RuntimeContext,
  options: {
    memo?: ResultMemo
    frame?: ScopeFrame | null
    table?: ScopeTable
  } = {}
): unknown {
  const scopeGeneration = options.frame?.generation ?? 0
  const canMemo = Boolean(options.memo) &&
    plan.pure &&
    plan.localDeps.length === 0 &&
    (plan.dynamicDeps?.length ?? 0) === 0
  if (canMemo && options.memo) {
    const looked = options.memo.lookup(plan.id, plan.stateDeps, scopeGeneration)
    if (looked.hit) return looked.value
  }

  if (options.frame && options.table) {
    const locals: Record<string, unknown> = {}
    for (const dep of plan.localDeps) {
      const name = dep.split('.')[0]
      const found = lookupBinding(options.table, options.frame, name)
      if (found.found) locals[name] = found.value
    }
    const overlay = new Proxy(ctx, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(locals, prop)) {
          return locals[prop]
        }
        return Reflect.get(target, prop, receiver)
      },
      has(target, prop) {
        if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(locals, prop)) return true
        return Reflect.has(target, prop)
      },
      getOwnPropertyDescriptor(target, prop) {
        if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(locals, prop)) {
          return { configurable: true, enumerable: true, writable: true, value: locals[prop] }
        }
        return Reflect.getOwnPropertyDescriptor(target, prop)
      }
    }) as RuntimeContext
    try {
      const value = runPreparedPlan(plan, overlay)
      if (canMemo) options.memo?.store(plan.id, plan.stateDeps, value, scopeGeneration)
      return value
    } catch (error) {
      options.memo?.notify('expression-error', plan.id)
      throw error
    }
  }

  try {
    const value = runPreparedPlan(plan, ctx)
    if (canMemo) options.memo?.store(plan.id, plan.stateDeps, value, scopeGeneration)
    return value
  } catch (error) {
    options.memo?.notify('expression-error', plan.id)
    throw error
  }
}
