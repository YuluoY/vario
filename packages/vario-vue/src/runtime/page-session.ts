import { effectScope, markRaw, inject, provide, getCurrentInstance, type EffectScope, type InjectionKey } from 'vue'
import type { PreparedNode, PreparedView, RuntimeContext, RuntimeBudget } from '@variojs/types'
import { ResultMemo, RuntimeSession, ErrorCodes, VarioError, clearCache, createScopeFrame, releaseScopeFrame, StateStore, getOrCreateEngine, getParentContext, type ScopeFrame, type ScopeTable, type DiagnosticSink } from '@variojs/core'
import type { SchemaNode, MaterialManifest } from '@variojs/schema'
import { getPreparedSources } from '@variojs/schema'
import type { VueRenderer } from '../renderer.js'
import { VueStateBridge } from './state-bridge.js'
import type { VirtualListAdapter } from './virtual-list-adapter.js'
import { releaseVueAdapter } from '../adapter.js'
import { createRuntimeMetricsSink, recordRuntimeMetric } from './runtime-metrics.js'

export type LoopCellRecord = {
  readonly key: string | number
  readonly index: number
}

export type SessionStatus = 'active' | 'inactive' | 'paused' | 'disposed'

export const pageSessionKey: InjectionKey<PageSession> = Symbol.for('vario.page-session')

export function providePageSession(session: PageSession): void {
  provide(pageSessionKey, session)
}

export function resolvePageSession(sessionId?: string): PageSession | undefined {
  const injected = getCurrentInstance() ? inject(pageSessionKey, null) : null
  if (injected && (!sessionId || injected.id === sessionId)) return injected
  return sessionId ? getPageSession(sessionId) : undefined
}

const sessions = new Map<string, PageSession>()
const sessionsByCtx = new WeakMap<object, PageSession>()

export function getPageSession(id: string): PageSession | undefined {
  return sessions.get(id)
}

export function getPageSessionForContext(ctx: RuntimeContext): PageSession | undefined {
  let current: object | null = ctx
  let depth = 0
  while (current && current !== Object.prototype && depth < 64) {
    depth++
    const found = sessionsByCtx.get(current)
    if (found) return found
    const proto = Object.getPrototypeOf(current)
    if (proto && proto !== Object.prototype) {
      current = proto
    } else {
      // loop/scope 转发 ctx 的原型固定为 Object.prototype：经 parents 登记回落父 ctx
      current = getParentContext(current) ?? null
      if (current === ctx) break
    }
  }
  return undefined
}

export function activePageSessionCount(): number {
  return sessions.size
}

export class PageSession {
  readonly id: string
  status: SessionStatus = 'active'
  view: PreparedView | null
  ctx: RuntimeContext | null
  readonly memo: ResultMemo
  readonly runtime: RuntimeSession
  bridge: VueStateBridge | null
  renderer: VueRenderer | null = null
  virtualAdapter: VirtualListAdapter | null = null
  readonly timers = new Set<ReturnType<typeof setTimeout>>()
  readonly subscriptions: Array<() => void> = []
  readonly executions = new Set<string>()
  readonly bySchema = new WeakMap<SchemaNode, PreparedNode>()
  readonly byId = new Map<string, PreparedNode>()
  readonly sources = new Map<string, SchemaNode>()
  readonly loopCells = new Map<string, readonly LoopCellRecord[]>()
  /** loop 模板后代节点集合（indexView 预计算）：拦截器据此判定，不依赖同步栈（T3.1） */
  readonly loopDescendants = new Set<string>()
  private readonly rendering = new Set<string>()
  private readonly lexicalStack: RuntimeContext[] = []
  readonly frames: ScopeTable = new Map()
  readonly materials: Map<string, MaterialManifest>
  readonly store: StateStore
  readonly sink: DiagnosticSink
  readonly budget: Partial<RuntimeBudget>
  private readonly frameStack: ScopeFrame[] = []
  private readonly scope: EffectScope
  private readonly unsub: () => void

  constructor(options: { ctx: RuntimeContext; view: PreparedView | null; renderer?: VueRenderer; virtualAdapter?: VirtualListAdapter | null; engineId?: string; runtimeBudget?: Partial<RuntimeBudget>; diagnosticSink?: DiagnosticSink }) {
    this.id = `pses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    this.ctx = options.ctx
    this.view = options.view
    this.renderer = options.renderer ?? null
    // T3.7：默认 null（全量渲染）；reference adapter 仅显式 opt-in，超出预算 emit 诊断
    this.virtualAdapter = options.virtualAdapter === undefined
      ? null
      : options.virtualAdapter
    this.sink = createRuntimeMetricsSink(options.diagnosticSink)
    this.budget = options.runtimeBudget ?? {}
    this.runtime = new RuntimeSession(options.ctx, { engineId: options.engineId ?? 'default', diagnosticSink: this.sink })
    this.memo = this.runtime.memo
    this.materials = getOrCreateEngine(this.runtime.engineId).materials
    this.store = new StateStore(options.ctx)
    this.bridge = options.view ? new VueStateBridge(options.view, options.runtimeBudget) : null
    this.scope = effectScope(true)
    this.indexView(options.view)
    if (options.view) {
      recordRuntimeMetric({
        name: 'schema-prepare',
        sessionId: this.id,
        engineId: this.runtime.engineId,
        pageId: this.id,
        schemaId: options.view.id,
        revision: options.view.revision,
        count: options.view.nodeCount
      }, this.sink)
    }
    this.unsub = this.store.subscribe(cs => {
      if (this.status !== 'active') return
      this.memo.bumpAll(cs.paths)
      this.bridge?.apply(cs, this.ctx ?? undefined)
    })
    sessions.set(this.id, this)
    sessionsByCtx.set(options.ctx, this)
    markRaw(this)
    recordRuntimeMetric({
      name: 'page-activate',
      sessionId: this.id,
      engineId: this.runtime.engineId,
      pageId: this.id,
      schemaId: options.view?.id,
      revision: options.view?.revision
    }, this.sink)
  }

  indexView(view: PreparedView | null): void {
    this.byId.clear()
    this.sources.clear()
    this.loopDescendants.clear()
    if (!view) return
    for (const node of view.nodes.values()) {
      this.byId.set(node.id, node)
    }
    const sources = getPreparedSources(view)
    if (sources) {
      for (const [id, live] of sources) {
        this.sources.set(id, live)
        const prepared = this.byId.get(id)
        if (prepared) this.bySchema.set(live, prepared)
      }
    }
    for (const plan of view.loops.values()) {
      const prepared = this.byId.get(plan.nodeId)
      if (prepared) this.bySchema.set(plan.template, prepared)
    }
    // 预计算 loop 模板后代集合：DFS 沿 childIds 收集（不含 loop 节点自身）
    const collectDescendants = (id: string): void => {
      const node = this.byId.get(id)
      if (!node) return
      for (const childId of node.childIds) {
        if (this.loopDescendants.has(childId)) continue
        this.loopDescendants.add(childId)
        collectDescendants(childId)
      }
    }
    for (const plan of view.loops.values()) {
      collectDescendants(plan.nodeId)
    }
  }

  node(id: string): PreparedNode | undefined {
    return this.byId.get(id)
  }

  source(id: string): SchemaNode | undefined {
    return this.sources.get(id)
  }

  pushRendering(id: string): void {
    this.rendering.add(id)
  }

  popRendering(id: string): void {
    this.rendering.delete(id)
  }

  isRendering(id: string): boolean {
    return this.rendering.has(id)
  }

  pushLexical(ctx: RuntimeContext): void {
    this.lexicalStack.push(ctx)
    sessionsByCtx.set(ctx, this)
  }

  popLexical(): void {
    this.lexicalStack.pop()
  }

  currentLexical(): RuntimeContext | null {
    return this.lexicalStack[this.lexicalStack.length - 1] ?? this.ctx
  }

  isLexical(): boolean {
    return this.lexicalStack.length > 0
  }

  pushScope(bindings: Record<string, unknown>): ScopeFrame {
    const parent = this.frameStack[this.frameStack.length - 1] ?? null
    const frame = createScopeFrame(parent, bindings)
    this.frames.set(frame.id, frame)
    this.frameStack.push(frame)
    return frame
  }

  popScope(): void {
    const frame = this.frameStack.pop()
    if (frame) releaseScopeFrame(this.frames, frame)
  }

  /**
   * 事件帧：按 id 登记到 frames 表（不入 frameStack），异步事件交叠时
   * 由调用方持有 frame 引用并在结束时 releaseFrame，脱离栈顶约束（FR-6）。
   */
  createEventFrame(bindings: Record<string, unknown>): ScopeFrame {
    const parent = this.currentFrame()
    const frame = createScopeFrame(parent, bindings)
    this.frames.set(frame.id, frame)
    return frame
  }

  /** 按 id 释放帧（事件结束 / 抛错时同样调用；session 已 dispose 时为 no-op） */
  releaseFrame(frame: ScopeFrame): void {
    releaseScopeFrame(this.frames, frame)
  }

  currentFrame(): ScopeFrame | null {
    return this.frameStack[this.frameStack.length - 1] ?? null
  }

  get state(): StateStore {
    return this.store
  }

  deactivate(): void {
    if (this.status === 'disposed') {
      throw new VarioError('Session disposed', ErrorCodes.SESSION_DISPOSED)
    }
    this.status = 'inactive'
    this.store.pause()
    ;(this.scope as EffectScope & { pause?: () => void }).pause?.()
    recordRuntimeMetric({ name: 'page-deactivate', sessionId: this.id }, this.sink)
  }

  /**
   * 从全局表摘除但不 dispose ctx（T3.8 SSR：ctx 归调用方所有，
   * hydrate 会用同一 ctx 建新会话；dispose 会把 ctx 标记为 disposed）。
   */
  detach(): void {
    if (this.status === 'disposed') return
    this.status = 'inactive'
    this.unsub()
    // RuntimeSession 只从 engine 摘除，不标记 ctx disposed（hydrate 复用同一 ctx）
    ;(this.runtime as { release?: () => void } | null)?.release?.()
    sessions.delete(this.id)
    if (this.ctx) sessionsByCtx.delete(this.ctx)
  }

  activate(): void {
    if (this.status === 'disposed') {
      throw new VarioError('Session disposed', ErrorCodes.SESSION_DISPOSED)
    }
    this.status = 'active'
    ;(this.scope as EffectScope & { resume?: () => void }).resume?.()
    this.store.resume()
    recordRuntimeMetric({ name: 'page-activate', sessionId: this.id }, this.sink)
  }

  pause(): void {
    if (this.status === 'disposed') {
      throw new VarioError('Session disposed', ErrorCodes.SESSION_DISPOSED)
    }
    this.status = 'paused'
    this.store.pause()
    ;(this.scope as EffectScope & { pause?: () => void }).pause?.()
  }

  resume(): void {
    if (this.status === 'disposed') {
      throw new VarioError('Session disposed', ErrorCodes.SESSION_DISPOSED)
    }
    this.status = 'active'
    ;(this.scope as EffectScope & { resume?: () => void }).resume?.()
    this.store.resume()
  }

  dispose(): void {
    if (this.status === 'disposed') return
    this.status = 'disposed'
    recordRuntimeMetric({ name: 'page-dispose', sessionId: this.id }, this.sink)
    this.scope.stop()
    this.unsub()
    this.store.dispose()
    this.timers.forEach(clearTimeout)
    this.timers.clear()
    this.subscriptions.forEach(fn => fn())
    this.subscriptions.length = 0
    this.executions.clear()
    this.loopCells.clear()
    this.runtime.dispose()
    if (this.ctx) {
      sessionsByCtx.delete(this.ctx)
      clearCache(this.ctx)
      releaseVueAdapter(this.ctx)
      // FR-7：dispose 只断引用，不删 $methods 的 key（宿主可继续使用/重新挂载）
    }
    this.lexicalStack.length = 0
    this.frameStack.length = 0
    this.frames.clear()
    // FR-14：共享 engine 的 materials 不随单页卸载清空
    this.renderer?.release()
    this.bridge?.tokens.clear()
    this.bridge = null
    this.byId.clear()
    this.sources.clear()
    this.view = null
    this.renderer = null
    this.virtualAdapter = null
    this.ctx = null
    ;(this as { runtime: RuntimeSession | null }).runtime = null
    sessions.delete(this.id)
  }
}
