/**
 * 循环上下文对象池
 *
 * 公开 shim：不 Object.create / setPrototypeOf 父 RuntimeContext。
 * 词法绑定放在 locals 上；state 通过 Proxy 转发到 parent。
 *
 * 词法写入（FR-9）：_set 首段为 $item / itemKey 时写回当前项，
 * 并按 itemsPath.<index>.<rest> 记录变更与失效缓存。
 */

import type { RuntimeContext } from '@variojs/types'
import { setPathValue } from './path.js'
import { createForwardingContext, getParentContext } from './forwarding-context.js'
import { recordChange } from './change-set.js'
import { invalidateCache } from '../expression/cache.js'
import { PathWriteError, ErrorCodes } from '../errors.js'
import type { DiagnosticSink } from '../diagnostics/diagnostic-sink.js'

export interface LoopContextOptions {
  /** 循环数据源在父 ctx 上的路径（如 'items'），用于词法写入的变更记录 */
  itemsPath?: string
  /** 当前项的别名（如 itemKey: 'user' 时 user 即当前项） */
  itemKey?: string
  /** 索引的别名 */
  indexKey?: string
}

class LoopContextPool {
  private pool: Array<Record<string, unknown>> = []

  acquire(): Record<string, unknown> {
    return {}
  }

  release(ctx: Record<string, unknown>): void {
    // 只清运行期临时绑定；词法绑定（$item/$index/别名）保留，
    // 事件闭包在 release 后仍需读取（prepared LoopItemCell 生命周期对齐）。
    for (const key of Object.keys(ctx)) {
      if (key === '$item' || key === '$index' || key === 'item' || key === 'index') continue
      if (!key.startsWith('$') && !key.startsWith('_')) {
        delete ctx[key]
      }
    }
  }

  clear(): void {
    this.pool.length = 0
  }

  get size(): number {
    return 0
  }
}

let globalPool: LoopContextPool | null = null

export function getLoopContextPool(): LoopContextPool {
  if (!globalPool) {
    globalPool = new LoopContextPool()
  }
  return globalPool
}

const loopTargets = new WeakMap<object, Record<string, unknown>>()

/** 诊断通道：无法定位 itemsPath 时的词法写入兜底 */
let lexicalFallbackSink: DiagnosticSink | null = null

export function setLoopDiagnosticSink(sink: DiagnosticSink): void {
  lexicalFallbackSink = sink
}

function copyParentLexical(locals: Record<string, unknown>, parentCtx: RuntimeContext): void {
  if (!Object.prototype.hasOwnProperty.call(parentCtx, '$item')
    && !Object.prototype.hasOwnProperty.call(parentCtx, '$index')) {
    return
  }
  for (const key of Object.keys(parentCtx)) {
    if (key.startsWith('_')) continue
    if (key === '$emit' || key === '$methods' || key === '$exprOptions') continue
    locals[key] = (parentCtx as Record<string, unknown>)[key]
  }
}

/**
 * 创建循环上下文（对象池 + Proxy 转发，不挂父 ctx 原型）。
 *
 * 词法写入规则：
 * - 首段为 $item / itemKey：写剩余路径到绑定对象，按 itemsPath.<index>.<rest> 记录变更
 * - 首段为 $index / indexKey：不可写，抛 PathWriteError
 * - 其余路径：透传父 ctx 的 _set
 */
export function createLoopContext(
  parentCtx: RuntimeContext,
  item: unknown,
  index: number,
  options?: LoopContextOptions
): RuntimeContext {
  const pool = getLoopContextPool()
  const locals = pool.acquire()
  copyParentLexical(locals, parentCtx)
  locals.$item = item
  locals.$index = index
  if (options?.itemKey) locals[options.itemKey] = item
  if (options?.indexKey) locals[options.indexKey] = index

  const itemsPath = options?.itemsPath
  const itemKeys = new Set<string>(['$item'])
  if (options?.itemKey) itemKeys.add(options.itemKey)
  const indexKeys = new Set<string>(['$index'])
  if (options?.indexKey) indexKeys.add(options.indexKey)

  const parentSet = parentCtx._set.bind(parentCtx)
  const loopSet = (path: string, value: unknown, setOptions?: { skipCallback?: boolean; bypassSession?: boolean }) => {
    const firstDot = path.indexOf('.')
    const first = firstDot === -1 ? path : path.slice(0, firstDot)
    if (indexKeys.has(first)) {
      throw new PathWriteError(
        path,
        `Cannot write loop index binding "${first}"`,
        ErrorCodes.PATH_FORBIDDEN_SEGMENT
      )
    }
    if (itemKeys.has(first)) {
      if (firstDot === -1) {
        throw new PathWriteError(
          path,
          `Cannot overwrite loop item binding "${first}"`,
          ErrorCodes.PATH_FORBIDDEN_SEGMENT
        )
      }
      const rest = path.slice(firstDot + 1)
      const ok = setPathValue(item as Record<string, unknown>, rest, value)
      if (!ok) {
        throw new PathWriteError(
          path,
          `Failed to write loop item path "${path}"`,
          ErrorCodes.PATH_WRITE_ERROR
        )
      }
      const changePath = itemsPath != null ? `${itemsPath}.${index}.${rest}` : null
      if (changePath) {
        invalidateCache(changePath, parentCtx)
        recordChange(parentCtx, changePath, value)
      } else {
        // 无法定位 itemsPath：根级兜底失效 + 诊断
        for (const key of Object.keys(parentCtx)) {
          if (!key.startsWith('$') && !key.startsWith('_')) {
            invalidateCache(key, parentCtx)
          }
        }
        lexicalFallbackSink?.emit({
          name: 'loop-lexical-write',
          diagnostic: {
            code: 'LOOP_LEXICAL_WRITE_FALLBACK',
            message: 'loop context without itemsPath; fallback root invalidation',
            path,
            phase: 'runtime'
          }
        })
      }
      return
    }
    parentSet(path, value, setOptions)
  }

  const loopCtx = createForwardingContext(parentCtx, locals)
  // 在转发原语拷贝系统 API 之后覆盖 _set，注入词法写入逻辑
  locals._set = loopSet
  loopTargets.set(loopCtx, locals)
  return loopCtx
}

/**
 * 释放循环上下文（删除登记；locals 上的词法绑定保留可读）
 */
export function releaseLoopContext(loopCtx: Partial<RuntimeContext>): void {
  const locals = loopTargets.get(loopCtx) ?? (loopCtx as Record<string, unknown>)
  loopTargets.delete(loopCtx)
  for (const key of ['_get', '_set', '$emit', '$methods', '$exprOptions'] as const) {
    delete locals[key]
  }
  const pool = getLoopContextPool()
  pool.release(locals)
}

/** 读取 loop ctx 上登记的 locals（诊断/测试用） */
export function getLoopLocals(loopCtx: object): Record<string, unknown> | undefined {
  return loopTargets.get(loopCtx)
}

export { getParentContext }
export function clearLoopContextPool(): void {
  if (globalPool) {
    globalPool.clear()
  }
}
