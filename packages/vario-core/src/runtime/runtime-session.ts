import type { RuntimeContext } from '@variojs/types'
import type { MaterialManifest } from '@variojs/types'
import { ResultMemo } from '../expression/result-memo.js'
import { getPolicyFingerprint, bindContextEngine } from '../expression/policy.js'
import { subscribeChangeSet, type ChangeListener } from './change-set.js'
import type { DiagnosticSink } from '../diagnostics/diagnostic-sink.js'

export type EngineOwner = {
  readonly id: string
  readonly sessions: Set<RuntimeSession>
  readonly materials: Map<string, MaterialManifest>
}

const engines = new Map<string, EngineOwner>()
const disposedContexts = new WeakSet<object>()
const contextSinks = new WeakMap<object, DiagnosticSink>()

export function isContextDisposed(ctx: object): boolean {
  return disposedContexts.has(ctx)
}

/** 登记与 ctx 关联的诊断 sink（RuntimeSession 构造时调用；disposed 后仍保留以便上报） */
export function bindContextSink(ctx: object, sink: DiagnosticSink): void {
  contextSinks.set(ctx, sink)
}

export function emitContextDiagnostic(
  ctx: object,
  event: Parameters<DiagnosticSink['emit']>[0]
): void {
  contextSinks.get(ctx)?.emit(event)
}

export function getOrCreateEngine(id = 'default'): EngineOwner {
  let engine = engines.get(id)
  if (!engine) {
    engine = { id, sessions: new Set(), materials: new Map() }
    engines.set(id, engine)
  }
  return engine
}

export function registerEngineMaterial(engineId: string, manifest: MaterialManifest): void {
  const key = manifest.type ?? manifest.name
  getOrCreateEngine(engineId).materials.set(key, manifest)
  if (manifest.name !== key) {
    getOrCreateEngine(engineId).materials.set(manifest.name, manifest)
  }
}

export function getEngineMaterial(engineId: string, name: string): MaterialManifest | undefined {
  return getOrCreateEngine(engineId).materials.get(name)
}

export class RuntimeSession {
  readonly id: string
  readonly engineId: string
  readonly memo: ResultMemo
  readonly ctx: RuntimeContext
  private readonly unsub: () => void
  disposed = false

  constructor(ctx: RuntimeContext, options: { engineId?: string; onChange?: ChangeListener; diagnosticSink?: DiagnosticSink } = {}) {
    this.id = `rses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    this.engineId = options.engineId ?? 'default'
    this.ctx = ctx
    this.memo = new ResultMemo({
      sessionId: this.id,
      policyFingerprint: getPolicyFingerprint(ctx.$exprOptions),
      sink: options.diagnosticSink
    })
    this.unsub = subscribeChangeSet(ctx, options.onChange ?? (() => {}))
    bindContextEngine(ctx, this.engineId)
    if (options.diagnosticSink) {
      bindContextSink(ctx, options.diagnosticSink)
    }
    getOrCreateEngine(this.engineId).sessions.add(this)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    disposedContexts.add(this.ctx)
    this.releaseFromEngine()
  }

  /**
   * 从 engine 摘除但不标记 ctx disposed（T3.8 SSR detach：ctx 归调用方所有，
   * hydrate 会用同一 ctx 建新会话，dispose 的 disposed 标记会毒化复用路径）。
   */
  release(): void {
    if (this.disposed) return
    this.disposed = true
    this.releaseFromEngine()
  }

  private releaseFromEngine(): void {
    this.unsub()
    this.memo.clear()
    const engine = getOrCreateEngine(this.engineId)
    engine.sessions.delete(this)
    // 非 default engine 无会话时删除条目，防止 engines Map 随挂载次数增长；
    // 共享 materials 不随单会话销毁（FR-14）。
    if (engine.sessions.size === 0 && this.engineId !== 'default') {
      engines.delete(this.engineId)
    }
    ;(this as { ctx: RuntimeContext | null }).ctx = null
  }
}
