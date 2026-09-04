import { shallowRef } from 'vue'
import type { ChangeSet, PreparedView, RuntimeContext, RuntimeBudget, VarioDiagnostic } from '@variojs/types'
import { matchPath } from '@variojs/core'
import { emitPerformance } from '../internal/performance-hooks.js'
import { recordRuntimeMetric } from './runtime-metrics.js'

const DEFAULT_MAX_DIRTY_REGIONS = 256

function loopItemCacheKey(
  item: unknown,
  index: number,
  keySource: string | null,
  itemKey: string
): string {
  if (keySource && item && typeof item === 'object') {
    const value = (item as Record<string, unknown>)[keySource]
    if (value != null && typeof value !== 'object') return String(value)
  }
  if (item && typeof item === 'object' && 'id' in (item as object) && (item as { id?: unknown }).id != null) {
    return String((item as { id: unknown }).id)
  }
  return `${itemKey}:${index}`
}

export class VueStateBridge {
  readonly tokens = new Map<string, ReturnType<typeof shallowRef<number>>>()
  readonly diagnostics: VarioDiagnostic[] = []
  private readonly flushedIds = new Set<string>()
  constructor(
    private readonly view: PreparedView,
    private readonly budget: Pick<RuntimeBudget, 'maxDirtyRegionsPerTick'> = {}
  ) {}

  tokenFor(regionId: string) {
    let token = this.tokens.get(regionId)
    if (!token) {
      token = shallowRef(0)
      this.tokens.set(regionId, token)
    }
    return token
  }

  apply(changeSet: ChangeSet, ctx?: RuntimeContext): void {
    const affected = new Set<string>()
    for (const path of changeSet.paths) {
      for (const [nodeId, loop] of this.view.loops) {
        const source = loop.itemsSource.replace(/^\{\{|\}\}$/g, '').trim()
        // loop 匹配用 items 表达式 plan 的 stateDeps 双向前缀匹配（T3.4：
        // 覆盖 {{ list.slice(0,5) }} 这类非裸路径的 items 源）
        const itemsPlan = loop.itemsPlanId ? this.view.expressions.get(loop.itemsPlanId) : undefined
        const deps = itemsPlan?.stateDeps.length ? itemsPlan.stateDeps : [source]
        if (!deps.some(dep => matchPath(dep, path) || matchPath(path, dep))) {
          continue
        }
        const rest = path === source ? '' : path.slice(source.length).replace(/^[.[]/, '')
        const indexMatch = rest.match(/^(\d+)/)
        if (indexMatch) {
          affected.add(`${nodeId}:${indexMatch[1]}`)
          const items = ctx?._get(source)
          if (Array.isArray(items)) {
            const index = Number(indexMatch[1])
            const key = loopItemCacheKey(items[index], index, loop.keySource, loop.itemKey)
            affected.add(`${nodeId}:k:${key}`)
          }
        } else {
          affected.add(nodeId)
        }
      }
      for (const node of this.view.nodes.values()) {
        if (node.region === 'static' || node.region === 'loop') continue
        // 节点依赖：expressionIds 之外并入 modelPlans[].path（T3.4）
        let hit = false
        for (const expressionId of node.expressionIds ?? []) {
          const plan = this.view.expressions.get(expressionId)
          if (!plan) continue
          if (plan.stateDeps.some(dep => matchPath(dep, path) || matchPath(path, dep))) {
            hit = true
            break
          }
        }
        if (!hit) {
          for (const modelPlan of node.modelPlans ?? []) {
            if (matchPath(modelPlan.path, path) || matchPath(path, modelPlan.path)) {
              hit = true
              break
            }
          }
        }
        if (hit) affected.add(node.id)
      }
    }
    const maxDirty = this.budget.maxDirtyRegionsPerTick ?? DEFAULT_MAX_DIRTY_REGIONS
    if (affected.size > maxDirty) {
      const diagnostic: VarioDiagnostic = {
        code: 'DIRTY_REGION_BUDGET',
        message: `dirty regions ${affected.size} exceed maxDirtyRegionsPerTick=${maxDirty}`,
        path: '',
        phase: 'runtime',
        metadata: { count: affected.size, max: maxDirty }
      }
      this.diagnostics.push(diagnostic)
      recordRuntimeMetric({ name: 'dirty-region-budget', count: affected.size })
      const rootId = this.view.rootNodeId
      if (rootId) affected.add(rootId)
    }
    for (const id of affected) {
      if (this.flushedIds.has(id)) continue
      this.flushedIds.add(id)
      const token = this.tokenFor(id)
      token.value = (token.value ?? 0) + 1
      emitPerformance('regionRender')
    }
    if (this.flushedIds.size > 0) {
      queueMicrotask(() => {
        this.flushedIds.clear()
      })
    }
  }
}
