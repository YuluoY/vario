/**
 * Teleport 插件
 *
 * 当 schema 节点声明了 teleport 时，用 Teleport 组件包裹 VNode。
 */

import type { VNode } from 'vue'
import type { VueSchemaNode } from '../types.js'
import type { VNodePlugin } from './types.js'
import { shouldTeleport, createTeleport } from '../features/teleport.js'

export const teleportPlugin: VNodePlugin = {
  name: 'teleport',

  decorateVNode(vnode: VNode, schema: VueSchemaNode): VNode {
    if (!shouldTeleport(schema.teleport)) return vnode
    return createTeleport(schema.teleport, vnode)
  }
}
