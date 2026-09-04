/**
 * Session-scoped expression result memo. Never shared across sessions.
 * Validity is keyed by plan id, policy, scope generation and dependency versions.
 */

import type { DiagnosticSink } from '../diagnostics/diagnostic-sink.js'
import { matchPath } from '../runtime/path.js'

export type MemoLookup =
  | { hit: true; value: unknown }
  | { hit: false }

export type ResultMemoStats = {
  size: number
  hits: number
  misses: number
  evicts: number
}

export class ResultMemo {
  readonly maxSize: number
  private readonly map = new Map<string, { value: unknown; fingerprint: string }>()
  private readonly versions = new Map<string, number>()
  /** 已见依赖索引：bump 时按双向前缀匹配传播失效（FR-2） */
  private readonly knownDeps = new Set<string>()
  private generation = 1
  private hits = 0
  private misses = 0
  private evicts = 0
  private readonly sessionId: string
  private readonly policyFingerprint: string
  private readonly sink?: DiagnosticSink

  constructor(options: { sessionId: string; maxSize?: number; policyFingerprint?: string; sink?: DiagnosticSink }) {
    this.sessionId = options.sessionId
    this.maxSize = options.maxSize ?? 2000
    this.policyFingerprint = options.policyFingerprint ?? 'default'
    this.sink = options.sink
  }

  bump(path: string): void {
    // 对已见依赖做双向前缀匹配：items 失效 items.length/items.0.name，
    // items.0.name 失效 items.0；并对 path 自身递增
    for (const dep of this.knownDeps) {
      if (matchPath(dep, path) || matchPath(path, dep)) {
        this.versions.set(dep, (this.versions.get(dep) ?? 0) + 1)
      }
    }
    this.versions.set(path, (this.versions.get(path) ?? 0) + 1)
  }

  bumpAll(paths: readonly string[]): void {
    for (const path of paths) this.bump(path)
  }

  nextGeneration(): number {
    this.generation += 1
    return this.generation
  }

  currentGeneration(): number {
    return this.generation
  }

  private versionToken(deps: readonly string[]): string {
    if (deps.length === 0) return `g${this.generation}`
    return deps.map(dep => `${dep}@${this.versions.get(dep) ?? 0}`).join('|')
  }

  private composeKey(planId: string, scopeGeneration: number, deps: readonly string[]): string {
    return `${this.sessionId}::${this.policyFingerprint}::${planId}::s${scopeGeneration}::${this.versionToken(deps)}`
  }

  lookup(planId: string, deps: readonly string[], scopeGeneration = 0): MemoLookup {
    const key = this.composeKey(planId, scopeGeneration, deps)
    const entry = this.map.get(key)
    if (!entry) {
      this.misses++
      this.sink?.emit({ name: 'expression-miss', sessionId: this.sessionId, planId })
      return { hit: false }
    }
    this.hits++
    this.sink?.emit({ name: 'expression-hit', sessionId: this.sessionId, planId })
    this.map.delete(key)
    this.map.set(key, entry)
    return { hit: true, value: entry.value }
  }

  store(planId: string, deps: readonly string[], value: unknown, scopeGeneration = 0): void {
    // 对象/数组/undefined 结果不入 memo（与 evaluate.ts 的 cacheable 规则对齐）
    if (value !== null && (typeof value === 'object' || value === undefined)) {
      return
    }
    if (this.knownDeps.size >= this.maxSize) {
      this.knownDeps.clear()
    }
    for (const dep of deps) this.knownDeps.add(dep)
    const key = this.composeKey(planId, scopeGeneration, deps)
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) {
        this.map.delete(oldest)
        this.evicts++
        this.sink?.emit({ name: 'expression-evict', sessionId: this.sessionId, planId, count: this.evicts })
      }
    }
    this.map.set(key, { value, fingerprint: this.policyFingerprint })
    this.sink?.emit({ name: 'expression-evaluate', sessionId: this.sessionId, planId })
  }

  notify(name: string, planId: string): void {
    this.sink?.emit({ name, sessionId: this.sessionId, planId })
  }

  stats(): ResultMemoStats {
    return { size: this.map.size, hits: this.hits, misses: this.misses, evicts: this.evicts }
  }

  clear(): void {
    this.map.clear()
    this.versions.clear()
    this.knownDeps.clear()
  }
}
