/**
 * Shared immutable ExpressionPlan LRU. Plans are frozen and keyed by
 * policy fingerprint + source. Not used for evaluated results.
 */

import type { ExpressionPlan } from '@variojs/types'
import { compileExpressionPlanUncached } from './plan-compiler.js'
import { getPolicyFingerprint } from './policy.js'

export type PlanCacheStats = {
  size: number
  hits: number
  misses: number
  evicts: number
}

const DEFAULT_MAX = 2000

export class PlanCache {
  readonly maxSize: number
  private readonly map = new Map<string, ExpressionPlan>()
  private hits = 0
  private misses = 0
  private evicts = 0

  constructor(maxSize = DEFAULT_MAX) {
    this.maxSize = maxSize
  }

  key(source: string, fingerprint = getPolicyFingerprint()): string {
    return `${fingerprint}::${source}`
  }

  get(source: string, fingerprint = getPolicyFingerprint()): ExpressionPlan | undefined {
    const key = this.key(source, fingerprint)
    const hit = this.map.get(key)
    if (!hit) {
      this.misses++
      return undefined
    }
    this.hits++
    this.map.delete(key)
    this.map.set(key, hit)
    return hit
  }

  set(plan: ExpressionPlan): ExpressionPlan {
    const key = plan.id
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) {
        this.map.delete(oldest)
        this.evicts++
      }
    }
    this.map.set(key, plan)
    return plan
  }

  getOrCompile(source: string, fingerprint = getPolicyFingerprint()): ExpressionPlan {
    const cached = this.get(source, fingerprint)
    if (cached) return cached
    const plan = compileExpressionPlanUncached(source)
    return this.set(plan)
  }

  stats(): PlanCacheStats {
    return { size: this.map.size, hits: this.hits, misses: this.misses, evicts: this.evicts }
  }

  clear(): void {
    this.map.clear()
  }
}

export const sharedPlanCache = new PlanCache(DEFAULT_MAX)

export function getCachedExpressionPlan(source: string): ExpressionPlan {
  return sharedPlanCache.getOrCompile(source)
}

export function getPlanCacheStats(): PlanCacheStats {
  return sharedPlanCache.stats()
}
