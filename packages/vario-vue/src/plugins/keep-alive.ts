/**
 * KeepAlive 插件
 *
 * 当 schema 节点声明了 keepAlive 时，用 KeepAlive 组件包裹 VNode。
 */

import { h, KeepAlive, type VNode } from 'vue'
import type { VueSchemaNode } from '../types.js'
import type { VNodePlugin } from './types.js'

export const keepAlivePlugin: VNodePlugin = {
  name: 'keep-alive',

  decorateVNode(vnode: VNode, schema: VueSchemaNode): VNode {
    if (!schema.keepAlive) return vnode
    const props = typeof schema.keepAlive === 'object' ? schema.keepAlive : {}
    return h(KeepAlive, props, () => vnode)
  }
}
