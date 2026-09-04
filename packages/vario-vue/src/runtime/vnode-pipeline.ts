import type { VNode } from 'vue'
import type { VueSchemaNode } from '../types.js'
import type { RuntimeContext } from '@variojs/types'
import type { VNodePlugin } from '../plugins/types.js'

export function applyVnodePipeline(
  vnode: VNode,
  schema: VueSchemaNode,
  ctx: RuntimeContext,
  plugins: VNodePlugin[]
): VNode {
  let next = vnode
  for (const plugin of plugins) {
    if (plugin.decorateVNode) {
      next = plugin.decorateVNode(next, schema, ctx) ?? next
    }
  }
  return next
}
