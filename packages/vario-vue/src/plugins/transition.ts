/**
 * Transition 插件
 *
 * 当 schema 节点声明了 transition 时，用 Transition 组件包裹 VNode。
 */

import { h, Transition, type VNode } from 'vue'
import type { VueSchemaNode } from '../types.js'
import type { VNodePlugin } from './types.js'

export const transitionPlugin: VNodePlugin = {
  name: 'transition',
  setup() {},
  validate() {},
  prepare() {},
  dispose() {},

  decorateVNode(vnode: VNode, schema: VueSchemaNode): VNode {
    if (!schema.transition) return vnode

    const transitionProps = typeof schema.transition === 'string'
      ? { name: schema.transition }
      : {
          ...schema.transition,
          duration: schema.transition.duration && typeof schema.transition.duration === 'object'
            ? (schema.transition.duration.enter && schema.transition.duration.leave
                ? { enter: schema.transition.duration.enter, leave: schema.transition.duration.leave }
                : undefined)
            : schema.transition.duration
        }

    return h(Transition, transitionProps as any, () => vnode)
  }
}
