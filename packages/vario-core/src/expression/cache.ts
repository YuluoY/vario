/**
 * 表达式缓存系统
 *
 * - 每个 RuntimeContext 独立缓存（WeakMap）
 * - Map 插入顺序 LRU，O(1) 淘汰，满容量不全表清空
 * - cache key 含 policyFingerprint
 * - hit/miss sentinel：null/undefined/false/0 可命中
 */

import type { RuntimeContext, ExpressionCache } from '@variojs/types'
import { matchPath } from '../runtime/path.js'
import { getPolicyFingerprint } from './policy.js'

const cacheMap = new WeakMap<RuntimeContext<Record<string, unknown>>, Map<string, ExpressionCache>>()
const cacheBook = new WeakMap<RuntimeContext<Record<string, unknown>>, { hits: number; misses: number; evicts: number }>()

function bookOf(ctx: RuntimeContext): { hits: number; misses: number; evicts: number } {
  const key = ctx as RuntimeContext<Record<string, unknown>>
  let book = cacheBook.get(key)
  if (!book) {
    book = { hits: 0, misses: 0, evicts: 0 }
    cacheBook.set(key, book)
  }
  return book
}

const CACHE_CONFIG = {
  maxSize: 2000,
  ttl: 0
} as const

export const CACHE_MISS = Symbol.for('vario.expression.cache.miss')

function cacheKey(expr: string, fingerprint: string): string {
  return `${fingerprint}::${expr}`
}

function getCache(ctx: RuntimeContext): Map<string, ExpressionCache> {
  let cache = cacheMap.get(ctx as RuntimeContext<Record<string, unknown>>)
  if (!cache) {
    cache = new Map()
    cacheMap.set(ctx as RuntimeContext<Record<string, unknown>>, cache)
  }
  return cache
}

function resolveFingerprint(ctx: RuntimeContext, fingerprint?: string): string {
  return fingerprint ?? getPolicyFingerprint(ctx.$exprOptions)
}

function isCacheValid(entry: ExpressionCache): boolean {
  if (CACHE_CONFIG.ttl > 0 && Date.now() - entry.timestamp > CACHE_CONFIG.ttl) {
    return false
  }
  return true
}

function evictOldest(cache: Map<string, ExpressionCache>, ctx: RuntimeContext): void {
  const oldestKey = cache.keys().next().value
  if (oldestKey !== undefined) {
    cache.delete(oldestKey)
    bookOf(ctx).evicts++
  }
}

export type CacheLookup =
  | { hit: true; value: unknown }
  | { hit: false }

export function lookupCachedExpression(
  expr: string,
  ctx: RuntimeContext,
  fingerprint?: string
): CacheLookup {
  const cache = getCache(ctx)
  const key = cacheKey(expr, resolveFingerprint(ctx, fingerprint))
  const entry = cache.get(key)

  if (!entry) {
    bookOf(ctx).misses++
    return { hit: false }
  }

  if (!isCacheValid(entry)) {
    cache.delete(key)
    bookOf(ctx).misses++
    return { hit: false }
  }

  cache.delete(key)
  cache.set(key, entry)
  bookOf(ctx).hits++
  return { hit: true, value: entry.result }
}

export function getCachedExpression(
  expr: string,
  ctx: RuntimeContext
): unknown | null {
  const looked = lookupCachedExpression(expr, ctx)
  if (!looked.hit) return null
  return looked.value === undefined ? null : looked.value
}

export function setCachedExpression(
  expr: string,
  result: unknown,
  dependencies: string[],
  ctx: RuntimeContext,
  fingerprint?: string
): void {
  const cache = getCache(ctx)
  const fp = resolveFingerprint(ctx, fingerprint)
  const key = cacheKey(expr, fp)

  if (cache.has(key)) {
    cache.delete(key)
  } else if (cache.size >= CACHE_CONFIG.maxSize) {
    evictOldest(cache, ctx)
  }

  cache.set(key, {
    expr,
    result,
    dependencies,
    timestamp: Date.now(),
    policyFingerprint: fp,
  })
}

export function invalidateCache(
  changedPath: string,
  ctx: RuntimeContext
): void {
  const cache = getCache(ctx)
  const toDelete: string[] = []

  for (const [expr, entry] of cache.entries()) {
    const isAffected = entry.dependencies.some(dep =>
      matchPath(dep, changedPath) || matchPath(changedPath, dep)
    )
    if (isAffected) {
      toDelete.push(expr)
    }
  }

  for (const expr of toDelete) {
    cache.delete(expr)
  }
}

export function clearCache(ctx: RuntimeContext): void {
  const cache = getCache(ctx)
  cache.clear()
}

export function getCacheStats(ctx: RuntimeContext): {
  size: number
  expressions: string[]
  hits: number
  misses: number
  evicts: number
} {
  const cache = getCache(ctx)
  const book = bookOf(ctx)
  return {
    size: cache.size,
    expressions: Array.from(cache.values()).map(e => e.expr),
    hits: book.hits,
    misses: book.misses,
    evicts: book.evicts
  }
}
