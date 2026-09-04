import { defineComponent, onBeforeUnmount } from 'vue'
import { createLoopContext, releaseLoopContext, evaluate, evaluateExpressionPlan, invalidateCache } from '@variojs/core'
import { resolvePageSession } from '../runtime/page-session.js'
import { emitPerformance } from '../internal/performance-hooks.js'
import type { RuntimeContext } from '@variojs/types'

function resolveLoopItems(ctx: RuntimeContext, itemsSource: string): unknown {
  const source = itemsSource.replace(/^\{\{|\}\}$/g, '').trim()
  if (!source) return undefined
  try {
    return evaluate(source, ctx)
  } catch (error) {
    if (error instanceof RangeError) throw error
    return ctx._get(source)
  }
}

let livePreparedLoopItemCells = 0

function syncLiveLoopItemCellProbe(): void {
  ;(globalThis as { __varioLiveLoopItemCells?: number }).__varioLiveLoopItemCells = livePreparedLoopItemCells
}

/**
 * prepared 循环项 cell：loopCtx 生命周期跟随本组件（T3.1/KG-8）——
 * render 结束不再释放，事件闭包与延迟渲染的 VarioNode 子树都能读到 $item；
 * item/index 变化时重建，onBeforeUnmount 释放。
 */
export const LoopItemCell = defineComponent({
  name: 'VarioPreparedLoopItemCell',
  props: {
    sessionId: { type: String, required: true },
    regionId: { type: String, required: true },
    itemIndex: { type: Number, required: true },
    itemKey: { type: [String, Number], required: true },
    generation: { type: Number, default: 0 }
  },
  setup(props: {
    sessionId: string
    regionId: string
    itemIndex: number
    itemKey: string | number
    generation: number
  }) {
    livePreparedLoopItemCells++
    syncLiveLoopItemCellProbe()
    let loopCtx: RuntimeContext | null = null
    let boundIndex: number | -1 = -1
    onBeforeUnmount(() => {
      if (loopCtx) releaseLoopContext(loopCtx)
      loopCtx = null
      livePreparedLoopItemCells--
      syncLiveLoopItemCellProbe()
    })
    return () => {
      const session = resolvePageSession(props.sessionId)
      if (!session?.view || !session.renderer || !session.bridge) return null
      const parentCtx = session.currentLexical() ?? session.ctx
      if (!parentCtx) return null
      void session.bridge.tokenFor(`${props.regionId}:${props.itemIndex}`).value
      void session.bridge.tokenFor(`${props.regionId}:k:${props.itemKey}`).value
      // 整表替换（_set('list')）只 bump region token：cell 的 key/props 不变时
      // Vue 会复用实例，这里同步读 region token 让 cell 跟随整表变更重渲染（T3.4）
      void session.bridge.tokenFor(props.regionId).value
      emitPerformance('loopCellRender')
      const node = session.node(props.regionId)
      const plan = node ? session.view.loops.get(node.id) : undefined
      if (!node || !plan) return null
      const expr = plan.itemsPlanId ? session.view.expressions.get(plan.itemsPlanId) : undefined
      let items: unknown
      if (expr) {
        try {
          items = evaluateExpressionPlan(expr, parentCtx, {
            memo: session.memo,
            frame: session.currentFrame(),
            table: session.frames
          })
        } catch (error) {
          if (error instanceof RangeError) throw error
        }
      }
      if (!Array.isArray(items)) items = resolveLoopItems(parentCtx, plan.itemsSource)
      if (!Array.isArray(items)) return null
      const item = items[props.itemIndex]
      const template = plan.template
      // item/index 变化时重建 loopCtx；否则复用并刷新绑定
      if (!loopCtx || boundIndex !== props.itemIndex) {
        if (loopCtx) releaseLoopContext(loopCtx)
        loopCtx = createLoopContext(parentCtx, item, props.itemIndex, {
          itemsPath: plan.itemsSource,
          itemKey: plan.itemKey,
          indexKey: plan.indexKey
        })
        boundIndex = props.itemIndex
      }
      const locals = loopCtx as unknown as Record<string, unknown>
      locals.$item = item
      locals.$index = props.itemIndex
      locals[plan.itemKey] = item
      if (plan.indexKey) locals[plan.indexKey] = props.itemIndex
      // loopCtx 跨渲染复用：词法绑定刷新后失效相关缓存（legacy evaluate 路径）
      invalidateCache('$item', loopCtx)
      invalidateCache(plan.itemKey, loopCtx)
      const renderCtx = loopCtx
      // 同步渲染期的 scope frame：别名 localDeps 经 currentFrame() 解析（FR-6：frameStack 仅渲染期）
      const bindings: Record<string, unknown> = {
        $item: item,
        $index: props.itemIndex,
        [plan.itemKey]: item,
        ...(plan.indexKey ? { [plan.indexKey]: props.itemIndex } : {})
      }
      session.pushScope(bindings)
      session.pushRendering(node.id)
      session.pushLexical(renderCtx)
      try {
        return session.renderer.renderNode(
          template,
          renderCtx,
          `${node.path}[${props.itemIndex}]`
        )
      } finally {
        session.popLexical()
        session.popRendering(node.id)
        session.popScope()
      }
    }
  }
})
