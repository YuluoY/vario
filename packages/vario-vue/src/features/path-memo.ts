/**
 * path-memo：按 path 缓存子树 VNode，未变分支复用
 *
 * 缓存 key = path + schema 标识 + 依赖值（cond/show 等），
 * 再次渲染时若输入未变则直接返回缓存 VNode，不递归子节点。
 *
 * schema 标识由节点身份 uid + 结构字段组成：
 * - 节点身份 uid：确保 ComputedRef<Schema> 每次重算产生的新节点对象不会误命中旧缓存
 * - 结构字段：type/cond/show/loop/childrenLen，用于同一节点重渲染时判断结构稳定性
 *
 * 含 loop 或 model 绑定的节点（及子树）不缓存（依赖 state，缓存会返回旧 VNode 导致双向绑定失效）。
 * 含表达式引用（{{ }} 或 ${}）的节点（及子树）也不缓存，否则 state 变化后无法触发重新渲染。
 */

import type { SchemaNode } from '@variojs/schema'
import type { VNode } from 'vue'

// ── subtree 检测结果缓存（Schema 节点是引用稳定的，WeakMap 不阻 GC） ──
const _exprCache = new WeakMap<SchemaNode, boolean>()
const _loopCache = new WeakMap<SchemaNode, boolean>()
const _modelCache = new WeakMap<SchemaNode, boolean>()
const _schemaIdCache = new WeakMap<SchemaNode, string>()

/**
 * 为每个 SchemaNode 引用分配单调递增的身份 uid
 *
 * 背景：path-memo 的缓存键历史上只包含结构字段（type/cond/show/loop/childrenLen），
 * 当 schema 以 `computed(() => ({...}))` 的形式每次重算产生全新节点对象时，新对象
 * 与旧缓存在结构上完全相同，会错误命中旧 VNode，导致 props 动态变化不生效
 * （典型症状：右侧配置面板里上传图片后 ElImage 不刷新）。
 *
 * 加入节点身份后：
 * - 静态 / 工厂 schema：同一对象 → 同一 uid → 缓存行为与之前完全一致（基准不退化）
 * - ComputedRef 重算：新对象 → 新 uid → 缓存未命中 → 正确重渲染
 *
 * WeakMap 以节点引用为键，schema 被 GC 时 uid 自动释放，无内存泄漏。
 */
const _schemaUidCache = new WeakMap<SchemaNode, number>()
let _schemaUidCounter = 0

/**
 * 检查字符串是否包含表达式引用（{{ }} 或 ${} 格式）
 */
function containsExpression(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return value.includes('{{') || value.includes('${')
}

/**
 * 检查对象中是否包含表达式引用（递归检查所有字符串值）
 */
function objectContainsExpression(obj: unknown): boolean {
  if (obj == null) return false
  if (typeof obj === 'string') return containsExpression(obj)
  if (Array.isArray(obj)) {
    return obj.some(item => objectContainsExpression(item))
  }
  if (typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).some(value => objectContainsExpression(value))
  }
  return false
}

/**
 * 当前节点是否有表达式引用（props/children/events 中包含 {{ }} 或 ${} 格式）
 * 这些表达式依赖 state，缓存后 state 变化将无法触发重新渲染
 */
function hasExpressionBinding(schema: SchemaNode): boolean {
  // 检查 cond 和 show（这些虽然也是表达式，但它们的值已经包含在 depsKey 中，所以不需要在这里检查）
  // 这里主要检查 props、children 和 events 中的表达式
  
  // 检查 props
  if (schema.props && objectContainsExpression(schema.props)) {
    return true
  }
  
  // 检查 children（如果是字符串，可能包含文本插值）
  if (typeof schema.children === 'string' && containsExpression(schema.children)) {
    return true
  }
  
  // 检查 events（事件处理器的 params 可能包含表达式，如 {{ scope.row }}）
  if (schema.events && objectContainsExpression(schema.events)) {
    return true
  }
  
  return false
}

/**
 * 创建带 WeakMap 缓存的子树检测器
 *
 * 三个 `hasXxxInSubtree` 结构完全相同——只差「当前节点是否命中」的谓词，
 * 抽成高阶函数消除重复。
 */
function createSubtreeChecker(
  cache: WeakMap<SchemaNode, boolean>,
  predicate: (schema: SchemaNode) => boolean
): (schema: SchemaNode) => boolean {
  const check = (schema: SchemaNode): boolean => {
    const cached = cache.get(schema)
    if (cached !== undefined) return cached
    let result = predicate(schema)
    if (!result) {
      const children = schema.children
      if (Array.isArray(children)) {
        result = (children as SchemaNode[]).some((c: SchemaNode) => check(c))
      }
    }
    cache.set(schema, result)
    return result
  }
  return check
}

/** 当前节点是否有 model 绑定（会生成 value/onUpdate 等，依赖 state） */
function hasModelBinding(schema: SchemaNode): boolean {
  const m = schema.model
  if (m != null) {
    if (typeof m === 'string') return m.length > 0
    const o = m as { path?: string; scope?: boolean }
    if (o.path != null && o.path.length > 0 && o.scope !== true) return true
  }
  const s = schema as Record<string, unknown>
  for (const k of Object.keys(s)) {
    if (k.startsWith('model:') && typeof s[k] === 'string' && (s[k] as string).length > 0) return true
  }
  return false
}

/** 是否包含表达式引用的子节点（含自身），含则不应缓存 */
export const hasExpressionInSubtree = createSubtreeChecker(_exprCache, hasExpressionBinding)

/** 是否包含 loop 子节点（含自身），含则不应缓存 */
export const hasLoopInSubtree = createSubtreeChecker(_loopCache, (s) => !!s.loop)

/** 是否包含 model 绑定的子节点（含自身），含则不应缓存 */
export const hasModelInSubtree = createSubtreeChecker(_modelCache, hasModelBinding)

/** 从 schema 生成稳定标识（不包含求值结果），WeakMap 缓存避免重复拼接 */
export function buildSchemaId(schema: SchemaNode): string {
  const cached = _schemaIdCache.get(schema)
  if (cached !== undefined) return cached
  // 节点身份 uid：让不同节点对象即使结构相同也产生不同缓存键，
  // 修复 ComputedRef<Schema> 重算时误命中缓存导致的 props 不刷新问题
  let uid = _schemaUidCache.get(schema)
  if (uid === undefined) {
    uid = ++_schemaUidCounter
    _schemaUidCache.set(schema, uid)
  }
  const type = schema.type ?? ''
  const cond = schema.cond ?? ''
  const show = schema.show ?? ''
  const loop = schema.loop != null ? JSON.stringify(schema.loop) : ''
  const childrenLen = Array.isArray(schema.children)
    ? schema.children.length
    : schema.children != null
      ? 1
      : 0
  const id = `#${uid}|${type}|${cond}|${show}|${loop}|${childrenLen}`
  _schemaIdCache.set(schema, id)
  return id
}

/** 依赖键：cond/show 的求值结果，用于缓存失效 */
export function buildDepsKey(condValue: unknown, showValue: unknown): string {
  return `${String(condValue)}|${String(showValue)}`
}

export function getCacheKey(path: string, schemaId: string, depsKey: string): string {
  return `${path}|${schemaId}|${depsKey}`
}

/** 按 path 的子树 VNode 缓存（带容量上限，防止无限增长） */
export class PathMemoCache {
  private cache = new Map<string, VNode>()
  private static MAX_SIZE = 5000

  get(key: string): VNode | undefined {
    return this.cache.get(key)
  }

  set(key: string, vnode: VNode): void {
    // 超出上限时清空重建（简单策略，避免 LRU 开销）
    if (this.cache.size >= PathMemoCache.MAX_SIZE) {
      this.cache.clear()
    }
    this.cache.set(key, vnode)
  }

  /** 清空缓存（如 schema 结构大变时） */
  clear(): void {
    this.cache.clear()
  }
}
