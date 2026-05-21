/**
 * Schema Scope Boundary 检测
 *
 * 判断节点是否引入新的响应式作用域，作为子树组件化的决策依据。
 * 组件化决策已简化：scope boundary 始终组件化，不再按权重条件判断。
 */

import type { SchemaNode } from '@variojs/schema'

/**
 * 判断节点是否为响应式作用域边界
 *
 * 边界类型：
 * 1. 有 lifecycle / provide / inject — 需要独立 setup 环境
 * 2. 有 model 绑定 — 绑定到特定状态路径，形成独立响应式通道
 * 3. 自定义组件（大写 type）— 天然的逻辑隔离单元
 */
export function isScopeBoundary(schema: SchemaNode): boolean {
  const s = schema as Record<string, unknown>

  // 1. lifecycle / provide / inject
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
  for (const k of Object.keys(s)) {
    if (k.startsWith('model:') && typeof s[k] === 'string') return true
  }

  // 3. 自定义组件（大写开头）
  const type = schema.type
  if (typeof type === 'string' && /^[A-Z]/.test(type)) return true

  return false
}
