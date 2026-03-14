/**
 * Schema Weight 计算与 Scope Boundary 检测
 *
 * 方案 C（Scope-Weight Hybrid）的核心模块：
 * - computeWeight: O(n) 自底向上计算每个 schema 节点的子树 VNode 权重
 * - isScopeBoundary: 判断节点是否引入新的响应式作用域
 *
 * 组件化决策公式：
 *   shouldComponentize = isScopeBoundary(node) && weight(node) > COMPONENT_OVERHEAD
 *
 * 其中 COMPONENT_OVERHEAD 为 Vue 组件实例的等价 VNode 成本（固定常数），
 * weight 为该节点子树的 VNode 总数。只有当隔离收益大于组件开销时才拆分。
 */

import type { SchemaNode } from '@variojs/schema'

/**
 * Vue 组件实例的等价 VNode 成本
 *
 * 一个 Vue 组件实例（setup + props diff + 生命周期）大约等价于 5 个 VNode 的 diff 开销。
 * 只有当子树 weight > 此值时，组件化才有净收益。
 */
export const COMPONENT_OVERHEAD = 5

/**
 * 子树权重缓存（WeakMap 保证 schema 被 GC 时自动清理）
 */
export type WeightCache = WeakMap<SchemaNode, number>

/**
 * 创建新的权重缓存实例
 */
export function createWeightCache(): WeightCache {
  return new WeakMap()
}

/**
 * 计算 schema 节点的子树 VNode 权重
 *
 * 规则：
 * - 叶子节点（无 children 或 children 为字符串）：weight = 1
 * - 容器节点：weight = 1 + Σ children.weight
 * - 循环节点：weight = 模板权重（不乘以 items 数量，运行时另行判断）
 *
 * 结果缓存在 WeakMap 中，同一 schema 对象只计算一次。
 * 内部使用 visiting Set 防止循环引用导致栈溢出。
 */
export function computeWeight(schema: SchemaNode, cache: WeightCache, _visiting?: Set<SchemaNode>): number {
  const cached = cache.get(schema)
  if (cached !== undefined) return cached

  // 循环引用检测：如果当前节点正在遍历中，返回 1 避免栈溢出
  const visiting = _visiting ?? new Set<SchemaNode>()
  if (visiting.has(schema)) return 1
  visiting.add(schema)

  let weight = 1 // 自身占 1

  const children = schema.children
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child && typeof child === 'object' && 'type' in child) {
        weight += computeWeight(child as SchemaNode, cache, visiting)
      } else {
        weight += 1 // 文本节点
      }
    }
  }
  // 字符串 children 不增加额外权重（已包含在自身的 1 中）

  visiting.delete(schema)
  cache.set(schema, weight)
  return weight
}

/**
 * 计算循环模板的权重（不含 loop 本身，仅模板部分）
 *
 * 循环项组件化决策用：当 templateWeight > COMPONENT_OVERHEAD 时，
 * 每个循环项值得包装为独立组件。
 */
export function computeLoopTemplateWeight(schema: SchemaNode, cache: WeightCache): number {
  // 循环模板 = 当前节点（去掉 loop）的子树
  // 如果有 children，计算 children 的总权重
  let weight = 1 // 模板根节点自身
  const children = schema.children
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child && typeof child === 'object' && 'type' in child) {
        weight += computeWeight(child as SchemaNode, cache)
      } else {
        weight += 1
      }
    }
  }
  return weight
}

/**
 * 判断节点是否为响应式作用域边界
 *
 * 作用域边界 = 引入新响应式依赖作用域的节点。
 * 在这些位置组件化可以隔离响应式依赖，使一个 scope 的状态变化
 * 不会引起其他 scope 的 re-render。
 *
 * 边界类型：
 * 1. 有 lifecycle / provide / inject — 需要独立 setup 环境
 * 2. 有 model 绑定 — 绑定到特定状态路径，形成独立响应式通道
 * 3. 自定义组件（大写 type）— 天然的逻辑隔离单元
 */
export function isScopeBoundary(schema: SchemaNode): boolean {
  // 1. lifecycle / provide / inject
  const s = schema as Record<string, unknown>
  if (s.onMounted || s.onUnmounted || s.onUpdated ||
      s.onBeforeMount || s.onBeforeUnmount || s.onBeforeUpdate) {
    return true
  }
  if (s.provide && typeof s.provide === 'object' && Object.keys(s.provide as object).length > 0) {
    return true
  }
  if (s.inject) {
    if (Array.isArray(s.inject) ? s.inject.length > 0 : Object.keys(s.inject as object).length > 0) {
      return true
    }
  }

  // 2. model 绑定
  if (schema.model != null) {
    if (typeof schema.model === 'string' && schema.model.length > 0) return true
    if (typeof schema.model === 'object') return true
  }
  // model:xxx 多字段绑定
  for (const k of Object.keys(s)) {
    if (k.startsWith('model:') && typeof s[k] === 'string') return true
  }

  // 3. 自定义组件（大写开头）
  const type = schema.type
  if (typeof type === 'string' && /^[A-Z]/.test(type)) return true

  return false
}
