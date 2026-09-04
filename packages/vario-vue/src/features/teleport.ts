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

import { defineComponent, h, onBeforeMount, Teleport, type VNode } from 'vue'
import { ErrorCodes, VarioError } from '@variojs/core'

function assertTeleportHost(to: string): void {
  const doc = (globalThis as { document?: { querySelector: (sel: string) => unknown } }).document
  if (!doc) return
  if (to === 'body' || to === 'html') return
  if (doc.querySelector(to) != null) return
  throw new VarioError(
    `Teleport host not found: ${to}`,
    ErrorCodes.TELEPORT_MISSING_HOST,
    { metadata: { target: to } }
  )
}

export const VarioTeleport = defineComponent({
  name: 'VarioTeleport',
  props: {
    to: { type: String, required: true }
  },
  setup(props: { to: string }, { slots }) {
    onBeforeMount(() => assertTeleportHost(props.to))
    return () => {
      assertTeleportHost(props.to)
      return h(Teleport as any, { to: props.to }, slots.default?.() ?? [])
    }
  }
})

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
  if (typeof to !== 'string' || to.trim() === '') {
    throw new VarioError('Invalid teleport target', ErrorCodes.TELEPORT_INVALID_TARGET)
  }
  const normalizedChildren = children 
    ? (Array.isArray(children) ? children : [children]) 
    : []
  
  // Teleport 需要使用 as any 来绑定类型
  return h(VarioTeleport, { to }, { default: () => normalizedChildren })
}

/**
 * 检查是否需要 teleport
 */
export function shouldTeleport(target: string | boolean | undefined): target is string | boolean {
  return target !== undefined && target !== false
}
