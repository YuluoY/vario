/**
 * path-memo：按 path 缓存子树 VNode，未变分支复用
 *
 * 缓存 key = path + schema 标识 + 依赖值（cond/show 等），
 * 再次渲染时若输入未变则直接返回缓存 VNode，不递归子节点。
 * 含 loop 或 model 绑定的节点（及子树）不缓存（依赖 state，缓存会返回旧 VNode 导致双向绑定失效）。
 * 含表达式引用（{{ }} 或 ${}）的节点（及子树）也不缓存，否则 state 变化后无法触发重新渲染。
 */

import type { SchemaNode } from '@variojs/schema'
import type { VNode } from 'vue'

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
 * 是否包含表达式引用的子节点（含自身），含则不应缓存
 * 否则 state 变化后缓存返回旧 VNode，导致 props/children 中的表达式无法更新
 */
export function hasExpressionInSubtree(schema: SchemaNode): boolean {
  if (hasExpressionBinding(schema)) return true
  const children = schema.children
  if (!Array.isArray(children)) return false
  return (children as SchemaNode[]).some((c: SchemaNode) => hasExpressionInSubtree(c))
}

/** 是否包含 loop 子节点（含自身），含则不应缓存 */
export function hasLoopInSubtree(schema: SchemaNode): boolean {
  if (schema.loop) return true
  const children = schema.children
  if (!Array.isArray(children)) return false
  return (children as SchemaNode[]).some((c: SchemaNode) => hasLoopInSubtree(c))
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

/** 是否包含 model 绑定的子节点（含自身），含则不应缓存，否则缓存会返回旧 value 导致输入框等双向绑定失效 */
export function hasModelInSubtree(schema: SchemaNode): boolean {
  if (hasModelBinding(schema)) return true
  const children = schema.children
  if (!Array.isArray(children)) return false
  return (children as SchemaNode[]).some((c: SchemaNode) => hasModelInSubtree(c))
}

/** 从 schema 生成稳定标识（不包含求值结果） */
export function buildSchemaId(schema: SchemaNode): string {
  const type = schema.type ?? ''
  const cond = schema.cond ?? ''
  const show = schema.show ?? ''
  const loop = schema.loop != null ? JSON.stringify(schema.loop) : ''
  const childrenLen = Array.isArray(schema.children)
    ? schema.children.length
    : schema.children != null
      ? 1
      : 0
  return `${type}|${cond}|${show}|${loop}|${childrenLen}`
}

/** 依赖键：cond/show 的求值结果，用于缓存失效 */
export function buildDepsKey(condValue: unknown, showValue: unknown): string {
  return `${String(condValue)}|${String(showValue)}`
}

export function getCacheKey(path: string, schemaId: string, depsKey: string): string {
  return `${path}|${schemaId}|${depsKey}`
}

/** 按 path 的子树 VNode 缓存 */
export class PathMemoCache {
  private cache = new Map<string, VNode>()

  get(key: string): VNode | undefined {
    return this.cache.get(key)
  }

  set(key: string, vnode: VNode): void {
    this.cache.set(key, vnode)
  }

  /** 可选：清空缓存（如 schema 结构大变时） */
  clear(): void {
    this.cache.clear()
  }
}
