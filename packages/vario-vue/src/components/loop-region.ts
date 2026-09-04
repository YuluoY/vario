import { defineComponent, h, Fragment, onUnmounted, getCurrentInstance, type VNode } from 'vue'
import { evaluate, evaluateExpressionPlan, VarioError, ErrorCodes, type DiagnosticSink } from '@variojs/core'
import type { LoopPlan, RuntimeContext } from '@variojs/types'
import { resolvePageSession, type PageSession } from '../runtime/page-session.js'
import { recordRuntimeMetric } from '../runtime/runtime-metrics.js'
import { emitPerformance } from '../internal/performance-hooks.js'
import { LoopItemCell } from './loop-item-cell.js'
import { assertExpandBudget } from '../runtime/virtual-list-adapter.js'

export function resolveLoopItems(ctx: RuntimeContext, itemsSource: string): unknown {
  const source = itemsSource.replace(/^\{\{|\}\}$/g, '').trim()
  if (!source) return undefined
  try {
    return evaluate(source, ctx)
  } catch (error) {
    if (error instanceof RangeError) throw error
    return ctx._get(source)
  }
}

export function resolvePreparedLoopItems(session: PageSession, plan: LoopPlan, ctx: RuntimeContext): unknown {
  const expr = plan.itemsPlanId ? session.view?.expressions.get(plan.itemsPlanId) : undefined
  if (expr) {
    try {
      return evaluateExpressionPlan(expr, ctx, {
        memo: session.memo,
        frame: session.currentFrame(),
        table: session.frames
      })
    } catch (error) {
      if (error instanceof RangeError) throw error
    }
  }
  return resolveLoopItems(ctx, plan.itemsSource)
}

export function resolveLoopItemKey(
  item: unknown,
  index: number,
  keySource: string | null,
  itemKey: string,
  path: string
): string | number {
  if (keySource && item && typeof item === 'object') {
    const value = (item as Record<string, unknown>)[keySource]
    if (value == null || typeof value === 'object') {
      throw new VarioError(`Loop key at ${path} is null/object`, ErrorCodes.LOOP_INVALID_KEY, { schemaPath: path })
    }
    return value as string | number
  }
  if (item && typeof item === 'object' && 'id' in (item as object) && (item as { id?: unknown }).id != null) {
    return String((item as { id: unknown }).id)
  }
  return `${itemKey}:${index}`
}

export function assertUniqueLoopKeys(
  keys: readonly (string | number)[],
  path: string,
  nodeId: string,
  sink?: DiagnosticSink,
  sessionId?: string
): void {
  const seen = new Set<string | number>()
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index]
    if (seen.has(key)) {
      sink?.emit({
        name: 'loop-duplicate-key',
        sessionId,
        nodeId,
        diagnostic: { code: ErrorCodes.LOOP_DUPLICATE_KEY, message: String(key), path, phase: 'render', nodeId }
      })
      throw new VarioError(`Duplicate loop key ${String(key)} at ${path}`, ErrorCodes.LOOP_DUPLICATE_KEY, { nodeId, schemaPath: path })
    }
    seen.add(key)
  }
}

export const LoopRegion = defineComponent({
  name: 'VarioLoopRegion',
  props: {
    sessionId: { type: String, required: true },
    regionId: { type: String, required: true }
  },
  setup(props: { sessionId: string; regionId: string }) {
    const regionInst = getCurrentInstance()
    onUnmounted(() => {
      if (regionInst) {
        const rec = regionInst as unknown as Record<string, unknown>
        rec.subTree = null
        rec.parent = null
        rec.root = null
        queueMicrotask(() => {
          rec.job = null
          rec.update = null
          rec.effect = null
          rec.render = null
          rec.um = null
          rec.bum = null
        })
      }
    })
    return () => {
      const session = resolvePageSession(props.sessionId)
      if (!session?.view || !session.renderer || !session.bridge || !session.ctx) return null
      void session.bridge.tokenFor(props.regionId).value
      emitPerformance('lrr')
      const node = session.node(props.regionId)
      const plan = node ? session.view.loops.get(node.id) : undefined
      if (!node || !plan) return null
      recordRuntimeMetric({ name: 'render-loop', sessionId: session.id, nodeId: node.id, count: 1 }, session.sink)
      const ctx = session.currentLexical() ?? session.ctx
      if (!ctx) return null
      const items = resolvePreparedLoopItems(session, plan, ctx)
      const list = Array.isArray(items) ? items : null
      const count = list ? list.length : 0
      if (count <= 0) return null
      if (count > 99) recordRuntimeMetric({ name: 'loop-large-list', nodeId: node.id, count }, session.sink)
      // T3.7：超过预算阈值时 emit LOOP_LARGE_LIST 诊断（不截断；全量渲染）
      const largeThreshold = (session.budget as { maxLoopItemsPerRegion?: number }).maxLoopItemsPerRegion ?? 1000
      if (count > largeThreshold) {
        session.sink.emit({
          name: 'loop-large-list',
          sessionId: session.id,
          nodeId: node.id,
          diagnostic: {
            code: 'LOOP_LARGE_LIST',
            message: `loop items ${count} exceed threshold ${largeThreshold}; consider a virtual adapter`,
            path: node.path,
            phase: 'runtime',
            metadata: { count, threshold: largeThreshold }
          }
        })
      }
      const adapter = plan.virtual === false ? null : session.virtualAdapter
      const range = adapter?.getVisibleRange({ itemCount: count }) ?? {
        start: 0,
        end: count,
        overscan: 0
      }
      const visible = Math.max(0, range.end - range.start)
      assertExpandBudget(count, adapter, session.budget, {
        projectedNodes: visible * (plan.estimatedTemplateNodes ?? 1),
        activeCells: visible,
        scopeDepth: session.currentFrame()?.generation ?? 0
      })
      adapter?.onItemsChanged?.({ itemCount: count })
      const children: VNode[] = []
      const cells: { key: string | number; index: number }[] = []
      const generation = session.currentFrame()?.generation ?? 0
      for (let index = range.start; index < range.end; index++) {
        const key = resolveLoopItemKey(list?.[index], index, plan.keySource, plan.itemKey, node.path)
        cells.push({ key, index })
        children.push(h(LoopItemCell, {
          key,
          sessionId: props.sessionId,
          regionId: node.id,
          itemIndex: index,
          itemKey: key,
          generation
        }))
      }
      assertUniqueLoopKeys(cells.map(cell => cell.key), node.path, node.id, session.sink, session.id)
      session.loopCells.set(node.id, Object.freeze(cells))
      return h(Fragment, null, children)
    }
  }
})
