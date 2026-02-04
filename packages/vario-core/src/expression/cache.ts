/**
 * 表达式缓存系统
 * 
 * 功能：
 * - 每个 RuntimeContext 独立缓存（WeakMap 关联）
 * - LRU 淘汰策略
 * - 通配符依赖匹配
 * - 缓存失效机制
 * 
 * 设计原则：
 * - 惰性求值：只在需要时计算
 * - 依赖追踪：精确的缓存失效
 * - 内存友好：WeakMap + LRU 淘汰
 */

import type { RuntimeContext, ExpressionCache } from '@variojs/types'
import { matchPath } from '../runtime/path.js'

/**
 * 每个上下文独立缓存
 * 使用 RuntimeContext 作为键（WeakMap 自动回收）
 */
const cacheMap = new WeakMap<RuntimeContext<Record<string, unknown>>, Map<string, ExpressionCache>>()

/**
 * 缓存配置
 */
const CACHE_CONFIG = {
  /** 最大缓存条目数 */
  maxSize: 100,
  /** 缓存有效期（毫秒），0 表示不过期 */
  ttl: 0
} as const

/**
 * 获取上下文的缓存 Map
 */
function getCache(ctx: RuntimeContext): Map<string, ExpressionCache> {
  let cache = cacheMap.get(ctx as RuntimeContext<Record<string, unknown>>)
  if (!cache) {
    cache = new Map()
    cacheMap.set(ctx as RuntimeContext<Record<string, unknown>>, cache)
  }
  return cache
}

/**
 * 检查缓存条目是否有效
 */
function isCacheValid(
  entry: ExpressionCache,
  ctx: RuntimeContext
): boolean {
  // TTL 检查
  if (CACHE_CONFIG.ttl > 0 && Date.now() - entry.timestamp > CACHE_CONFIG.ttl) {
    return false
  }
  
  // 依赖检查：所有依赖的值必须存在
  return entry.dependencies.every(dep => {
    if (dep.includes('*')) {
      // 通配符依赖：检查父路径是否存在
      const parentPath = dep.split('.*')[0]
      return ctx._get(parentPath) != null
    }
    // 具体路径：检查值是否存在
    return ctx._get(dep) !== undefined
  })
}

/**
 * LRU 淘汰：删除最旧的缓存条目
 */
function evictOldest(cache: Map<string, ExpressionCache>): void {
  let oldestKey: string | null = null
  let oldestTime = Infinity
  
  for (const [key, entry] of cache.entries()) {
    if (entry.timestamp < oldestTime) {
      oldestTime = entry.timestamp
      oldestKey = key
    }
  }
  
  if (oldestKey) {
    cache.delete(oldestKey)
  }
}

/**
 * 获取缓存的表达式结果
 * 
 * @param expr 表达式字符串
 * @param ctx 运行时上下文
 * @returns 缓存的结果，无缓存或已失效返回 null
 */
export function getCachedExpression(
  expr: string,
  ctx: RuntimeContext
): unknown | null {
  const cache = getCache(ctx)
  const entry = cache.get(expr)
  
  if (!entry) {
    return null
  }
  
  if (!isCacheValid(entry, ctx)) {
    cache.delete(expr)
    return null
  }
  
  // 更新时间戳（LRU）
  entry.timestamp = Date.now()
  return entry.result
}

/**
 * 设置表达式缓存
 * 
 * @param expr 表达式字符串
 * @param result 求值结果
 * @param dependencies 依赖的状态路径
 * @param ctx 运行时上下文
 */
export function setCachedExpression(
  expr: string,
  result: unknown,
  dependencies: string[],
  ctx: RuntimeContext
): void {
  const cache = getCache(ctx)
  
  // LRU 淘汰
  if (cache.size >= CACHE_CONFIG.maxSize) {
    evictOldest(cache)
  }
  
  cache.set(expr, {
    expr,
    result,
    dependencies,
    timestamp: Date.now()
  })
}

/**
 * 使缓存失效
 * 
 * 当状态变化时调用，精确删除依赖该状态的缓存
 * 
 * @param changedPath 变化的状态路径
 * @param ctx 运行时上下文
 */
export function invalidateCache(
  changedPath: string,
  ctx: RuntimeContext
): void {
  const cache = getCache(ctx)
  const toDelete: string[] = []
  
  for (const [expr, entry] of cache.entries()) {
    // 检查是否有依赖被影响
    const isAffected = entry.dependencies.some(dep => 
      matchPath(dep, changedPath) || matchPath(changedPath, dep)
    )
    
    if (isAffected) {
      toDelete.push(expr)
    }
  }
  
  // 批量删除
  for (const expr of toDelete) {
    cache.delete(expr)
  }
}

/**
 * 清除指定上下文的所有缓存
 */
export function clearCache(ctx: RuntimeContext): void {
  const cache = getCache(ctx)
  cache.clear()
}

/**
 * 获取缓存统计信息（调试用）
 */
export function getCacheStats(ctx: RuntimeContext): {
  size: number
  expressions: string[]
} {
  const cache = getCache(ctx)
  return {
    size: cache.size,
    expressions: Array.from(cache.keys())
  }
}
