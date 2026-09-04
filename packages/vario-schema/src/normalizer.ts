/**
 * Schema 规范化器
 * 
 * 功能：
 * - 统一格式（标准化属性顺序、默认值）
 * - 优化结构（移除冗余、合并相同属性、扁平化）
 * - 深度规范化（递归处理子节点）
 * - 性能优化（缓存规范化结果）
 * 
 * 遵循 TypeScript 最佳实践：
 * - 使用 readonly 确保不可变性
 * - 使用类型守卫
 * - 使用深度克隆避免副作用
 */

import type { ModelScopeConfig, SchemaNode, EventHandler } from './schema.types.js'
import { normalizeEventHandler } from './event-handler.js'

/**
 * 规范化结果缓存（基于对象引用）
 * 用于避免重复规范化相同的 Schema 节点
 */
let normalizationCache = new WeakMap<SchemaNode, SchemaNode>()

const KNOWN_FIELDS = new Set([
  'type', 'props', 'children', 'events', 'cond', 'show', 'loop', 'model'
])

/**
 * 规范化 Schema 节点
 * 
 * @param node Schema 节点
 * @returns 规范化后的 Schema 节点（新对象，不修改原对象）
 */
export function normalizeSchemaNode<TState extends Record<string, unknown>>(
  node: SchemaNode<TState>
): SchemaNode<TState> {
  const cached = normalizationCache.get(node)
  if (cached) {
    return cached as SchemaNode<TState>
  }

  const normalized: Record<string, unknown> = {}

  for (const key of Object.keys(node)) {
    if (!KNOWN_FIELDS.has(key) && !key.startsWith('model:')) {
      normalized[key] = (node as Record<string, unknown>)[key]
    }
  }

  normalized.type = node.type.trim()

  if (node.props !== undefined) {
    normalized.props = normalizeProps(node.props)
  }

  if (node.children !== undefined) {
    if (typeof node.children === 'string') {
      normalized.children = normalizeTextChildren(node.children)
    } else {
      normalized.children = node.children.map(child => normalizeSchemaNode(child))
    }
  }

  if (node.events !== undefined && Object.keys(node.events).length > 0) {
    const normalizedEvents = normalizeEvents(node.events)
    if (Object.keys(normalizedEvents).length > 0) {
      normalized.events = normalizedEvents
    }
  }

  if (node.cond !== undefined) {
    normalized.cond = typeof node.cond === 'string' ? node.cond.trim() : node.cond
  }

  if (node.show !== undefined) {
    normalized.show = typeof node.show === 'string' ? node.show.trim() : node.show
  }

  if (node.loop !== undefined) {
    normalized.loop = normalizeLoop(node.loop)
  }

  if (node.model !== undefined) {
    if (typeof node.model === 'string') {
      normalized.model = node.model.trim()
    } else if (
      typeof node.model === 'object' &&
      node.model !== null &&
      typeof (node.model as ModelScopeConfig).path === 'string'
    ) {
      const mo = node.model as ModelScopeConfig
      const model: Record<string, unknown> = { path: mo.path.trim() }
      if (mo.scope !== undefined) model.scope = mo.scope
      if (mo.default !== undefined) model.default = mo.default
      if (mo.lazy !== undefined) model.lazy = mo.lazy
      if (mo.modifiers !== undefined) model.modifiers = mo.modifiers
      normalized.model = model
    } else {
      normalized.model = node.model
    }
  }

  for (const key in node) {
    if (key.startsWith('model:') && typeof (node as Record<string, unknown>)[key] === 'string') {
      normalized[key] = ((node as Record<string, unknown>)[key] as string).trim()
    }
  }

  const result = normalized as SchemaNode<TState>
  normalizationCache.set(node, result)
  return result
}

/**
 * 规范化属性对象
 * 
 * - 移除 undefined 值
 * - 规范化表达式插值格式
 */
function normalizeProps(
  props: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const normalized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props)) {
    // 跳过 undefined 值
    if (value === undefined) {
      continue
    }

    // 规范化字符串值（表达式插值）
    if (typeof value === 'string') {
      normalized[key] = normalizeExpressionString(value)
    } else if (value === null) {
      normalized[key] = null
    } else if (Array.isArray(value)) {
      const filtered = value.filter(item => item !== undefined)
      normalized[key] = filtered
    } else if (typeof value === 'object' && value !== null) {
      // 规范化嵌套对象（递归）
      const normalizedObj = normalizeProps(value as Record<string, unknown>)
      normalized[key] = normalizedObj
    } else {
      normalized[key] = value
    }
  }

  return normalized
}

/**
 * 规范化文本子节点
 * 
 * - 规范化表达式插值格式
 */
function normalizeTextChildren(children: string): string {
  return normalizeExpressionString(children)
}

/**
 * 规范化表达式字符串
 * 
 * - 统一插值语法格式（{{ ... }}）
 * - 去除多余空格
 */
function normalizeExpressionString(str: string): string {
  // 如果包含插值语法，规范化格式
  if (str.includes('{{')) {
    return str.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expr) => {
      return `{{ ${expr.trim()} }}`
    })
  }

  return str
}

/**
 * 规范化事件处理器
 * 
 * - 确保指令数组不为空
 * - 移除空数组
 */
function normalizeEvents(
  events: Readonly<Record<string, EventHandler>>
): Readonly<Record<string, EventHandler>> {
  const normalized: Record<string, EventHandler> = {}

  for (const [eventName, handler] of Object.entries(events)) {
    // 跳过 undefined 或 null
    if (handler == null) {
      continue
    }

    if (Array.isArray(handler) && handler.length === 0) {
      continue
    }

    normalized[eventName] = normalizeEventHandler(handler)
  }

  return normalized
}

/**
 * 规范化循环配置
 */
function normalizeLoop(
  loop: Readonly<{ items: string; itemKey: string; indexKey?: string }>
): Readonly<{ items: string; itemKey: string; indexKey?: string }> {
  const normalized: { items: string; itemKey: string; indexKey?: string } = {
    items: loop.items.trim(),
    itemKey: loop.itemKey.trim()
  }

  if (loop.indexKey !== undefined && loop.indexKey.trim().length > 0) {
    normalized.indexKey = loop.indexKey.trim()
  }

  return normalized
}

/**
 * 规范化整个 Schema
 * 
 * @param schema Schema 根节点
 * @returns 规范化后的 Schema（新对象，不修改原对象）
 */
export function normalizeSchema<TState extends Record<string, unknown>>(
  schema: SchemaNode<TState>
): SchemaNode<TState> {
  return normalizeSchemaNode(schema)
}

/**
 * 清除规范化缓存
 * 用于测试或内存管理
 */
export function clearNormalizationCache(): void {
  normalizationCache = new WeakMap<SchemaNode, SchemaNode>()
}
