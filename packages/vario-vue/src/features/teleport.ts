/**
 * Teleport 支持
 * 
 * 将组件传送到指定的 DOM 节点
 * 
 * 特性：
 * - 支持 CSS 选择器目标
 * - 支持 boolean（true = body）
 * - 优雅地处理空 children
 */

import { h, Teleport, type VNode } from 'vue'

/**
 * 创建 Teleport VNode
 * 
 * @param target 传送目标（CSS 选择器或 true 表示 body）
 * @param children 子节点
 */
export function createTeleport(
  target: string | boolean,
  children: VNode | VNode[] | null
): VNode {
  const to = target === true ? 'body' : target
  const normalizedChildren = children 
    ? (Array.isArray(children) ? children : [children]) 
    : []
  
  // Teleport 需要使用 as any 来绑定类型
  return h(Teleport as any, { to }, normalizedChildren)
}

/**
 * 检查是否需要 teleport
 */
export function shouldTeleport(target: string | boolean | undefined): target is string | boolean {
  return target !== undefined && target !== false
}
