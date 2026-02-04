/**
 * 列表项组件化：每项独立 Vue 组件，仅该项 props 变化时 re-render。
 * 与 path-memo 并存：列表用 B，其它用 A。
 */

import { defineComponent, type VNode } from 'vue'
import type { RuntimeContext, PathSegment } from '@variojs/types'
import type { SchemaNode } from '@variojs/schema'
import { createLoopContext } from '@variojs/core'

export interface LoopItemCellProps {
  item: unknown
  index: number
  childSchema: SchemaNode
  parentSchema: SchemaNode
  parentCtx: RuntimeContext
  modelPathStack: PathSegment[]
  parentPath: string
  itemPath: string
  itemKey: string
  indexKey?: string
  loop: { items: string; itemKey: string; indexKey?: string }
  renderNode: (
    schema: SchemaNode,
    ctx: RuntimeContext,
    modelPathStack: PathSegment[],
    nodeContext: { parent?: SchemaNode; siblings?: SchemaNode[]; selfIndex?: number; path?: string },
    path: string
  ) => VNode | null
  getLoopItemKey: (item: unknown, itemKey: string, index: number) => string | number
}

export const LoopItemCell = defineComponent({
  name: 'LoopItemCell',
  props: {
    item: { type: null, required: true },
    index: { type: Number, required: true },
    childSchema: { type: Object, required: true },
    parentSchema: { type: Object, required: true },
    parentCtx: { type: Object, required: true },
    modelPathStack: { type: Array, required: true },
    parentPath: { type: String, required: true },
    itemPath: { type: String, required: true },
    itemKey: { type: String, required: true },
    indexKey: { type: String, default: undefined },
    loop: { type: Object, required: true },
    renderNode: { type: Function, required: true },
    getLoopItemKey: { type: Function, required: true }
  },
  setup(props: LoopItemCellProps) {
    return () => {
      const loopCtx = createLoopContext(
        props.parentCtx as RuntimeContext,
        props.item,
        props.index
      )
      const loop = props.loop as { itemKey: string; indexKey?: string }
      ;(loopCtx as Record<string, unknown>)[loop.itemKey] = props.item
      if (loop.indexKey) {
        ;(loopCtx as Record<string, unknown>)[loop.indexKey] = props.index
      }
      const nodeContext = {
        parent: props.parentSchema,
        siblings: [] as SchemaNode[],
        selfIndex: props.index,
        path: props.itemPath
      }
      const vnode = props.renderNode(
        props.childSchema,
        loopCtx,
        props.modelPathStack,
        nodeContext,
        props.itemPath
      )
      if (vnode && typeof vnode === 'object' && 'key' in vnode) {
        const keyValue = props.getLoopItemKey(props.item, props.itemKey, props.index)
        ;(vnode as VNode & { key?: string | number }).key = keyValue
      }
      return vnode
    }
  }
})
