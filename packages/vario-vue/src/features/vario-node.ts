/**
 * 子树组件化
 *
 * 在响应式作用域边界自动包装为 VarioNode。
 * Vue 的组件级 diff 自动跳过 props 未变的组件。
 */

import {
  defineComponent,
  h,
  computed,
  onErrorCaptured,
  type VNode,
  type PropType,
} from 'vue'
import type { SchemaNode } from '@variojs/schema'
import type { RuntimeContext, PathSegment } from '@variojs/core'
import type { NodeContext, ParentMap } from './node-context.js'
import type { VueSchemaNode } from '../types.js'
import { isScopeBoundary } from './schema-weight.js'
import { parseStyleString } from './style-utils.js'

/**
 * VarioNode 组件的 Props
 */
export interface VarioNodeProps {
  /** Schema 节点 */
  schema: SchemaNode
  /** 运行时上下文 */
  ctx: RuntimeContext
  /** 节点路径 */
  path: string
  /** Model 路径栈 */
  modelPathStack: PathSegment[]
  /** 节点上下文（父节点、兄弟节点等） */
  nodeContext?: NodeContext
  /** 父节点映射 */
  parentMap?: ParentMap
  /** 渲染器引用（用于调用内部方法） */
  renderer: VarioNodeRenderer
  /** 组件级别（用于性能调试） */
  depth?: number
}

/**
 * VarioNode 需要的渲染器接口
 */
export interface VarioNodeRenderer {
  /** 解析组件类型 */
  resolveComponent: (type: string) => any
  /** 求值表达式 */
  evaluateExpr: (expr: string, ctx: RuntimeContext) => unknown
  /** 构建属性 */
  buildAttrs: (
    schema: SchemaNode,
    ctx: RuntimeContext,
    component: any,
    modelPathStack: PathSegment[],
    nodeContext?: NodeContext,
    parentMap?: ParentMap
  ) => Record<string, any>
  /** 解析子节点 */
  resolveChildren: (
    schema: SchemaNode,
    ctx: RuntimeContext,
    modelPathStack: PathSegment[],
    parentMap?: ParentMap,
    path?: string
  ) => any
  /** 尝试通过插件包装组件（lifecycle/provide-inject 等），返回 null 则走默认 h() */
  wrapComponent?: (
    component: any,
    attrs: Record<string, any>,
    children: any,
    vueSchema: VueSchemaNode,
    ctx: RuntimeContext
  ) => VNode | null
  /** 通过插件装饰 VNode（keepAlive/transition/teleport 等） */
  decorateVNode?: (
    vnode: VNode,
    vueSchema: VueSchemaNode,
    ctx: RuntimeContext
  ) => VNode
  /** 附加 ref */
  attachRef?: (vnode: VNode, vueSchema: VueSchemaNode, ctx?: RuntimeContext) => VNode
  /** 获取 model 路径栈更新 */
  getUpdatedModelPathStack?: (
    schema: SchemaNode,
    modelPathStack: PathSegment[],
    ctx: RuntimeContext
  ) => PathSegment[]
}


/**
 * 递归统计子树后代节点总数（不含自身），达到 threshold 即提前返回。
 * 只在 scope boundary 上调用，单次遍历无缓存，超大树 early-exit 避免全量遍历。
 */
export function countDescendants(schema: SchemaNode, threshold?: number): number {
  if (!Array.isArray(schema.children)) return 0
  let total = schema.children.length
  if (threshold != null && total >= threshold) return total
  for (const child of schema.children) {
    if (child && typeof child === 'object' && 'type' in child) {
      total += countDescendants(child as SchemaNode, threshold != null ? threshold - total : undefined)
      if (threshold != null && total >= threshold) return total
    }
  }
  return total
}

/**
 * 判断是否应该组件化该节点。
 *
 * 规则：
 * - loop 节点不组件化（由 LoopHandler 处理）
 * - _componentize: true 显式强制组件化（绕过 scope boundary 和后代阈值检查）
 * - 非 scope boundary 不组件化
 * - scope boundary 且后代 >= 5 时组件化（避免小组件化开销大于内联渲染）
 */
export function shouldComponentize(schema: SchemaNode): boolean {
  if (schema.loop) return false

  // 显式 opt-in：_componentize 标志绕过 scope boundary 和后代阈值
  const s = schema as Record<string, unknown>
  if (s._componentize === true) return true

  if (!isScopeBoundary(schema)) return false
  return countDescendants(schema, 5) >= 5
}

/**
 * VarioNode - 子树组件化的核心组件
 *
 * 每个 VarioNode 代表 schema 树中的一个节点，
 * Vue 会自动对 props 未变的组件跳过 re-render。
 */
export const VarioNode = defineComponent({
  name: 'VarioNode',
  props: {
    schema: {
      type: Object as PropType<SchemaNode>,
      required: true
    },
    ctx: {
      type: Object as PropType<RuntimeContext>,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    modelPathStack: {
      type: Array as PropType<PathSegment[]>,
      default: () => []
    },
    nodeContext: {
      type: Object as PropType<NodeContext>,
      default: undefined
    },
    parentMap: {
      type: Object as PropType<ParentMap>,
      default: undefined
    },
    renderer: {
      type: Object as PropType<VarioNodeRenderer>,
      required: true
    },
    depth: {
      type: Number,
      default: 0
    }
  },
  setup(props) {
    onErrorCaptured((error) => {
      if (error instanceof RangeError) throw error
      return false
    })

    // 使用 computed 缓存条件求值结果
    const condValue = computed(() => {
      if (!props.schema.cond) return true
      try {
        return props.renderer.evaluateExpr(props.schema.cond, props.ctx)
      } catch (error) {
        if (error instanceof RangeError) throw error
        return false
      }
    })

    const showValue = computed(() => {
      if (!props.schema.show) return true
      try {
        return props.renderer.evaluateExpr(props.schema.show, props.ctx)
      } catch (error) {
        if (error instanceof RangeError) throw error
        return true
      }
    })

    // 使用 computed 缓存组件解析结果
    const component = computed(() => {
      return props.renderer.resolveComponent(props.schema.type)
    })

    // 使用 computed 缓存 model 路径栈
    const currentModelPathStack = computed(() => {
      if (props.renderer.getUpdatedModelPathStack) {
        return props.renderer.getUpdatedModelPathStack(
          props.schema,
          props.modelPathStack,
          props.ctx
        )
      }
      return props.modelPathStack
    })

    return () => {
      const { schema, ctx, path, nodeContext, parentMap, renderer } = props

      // 条件渲染
      if (!condValue.value) {
        return null
      }

      // 处理 loop（循环节点不应在 VarioNode 内处理）
      // 注意：含 loop 的节点不应被组件化为 VarioNode，
      // 因为 LoopHandler 需要在 renderer.createVNode 层面处理循环逻辑。
      // 如果到达这里说明 shouldComponentize 未正确排除 loop 节点。
      // 安全回退：返回 null，让 Vue 跳过渲染
      if (schema.loop) {
        return null
      }

      const resolvedComponent = component.value
      if (!resolvedComponent) {
        return h('div', { style: 'color: red; padding: 10px;' }, `Component "${schema.type}" not found`)
      }

      // 构建属性
      // 注意：自身 model 绑定必须用「原始」modelPathStack——renderer.buildAttrs 内部会自行
      // 处理 scope 压栈。传 push 后的栈会把自身段拼进 model 路径（'x' → 'x.x'），
      // 触发默认值预写把标量 state 键替换为嵌套对象（ElDialog 永不关闭等症状）
      const attrs = renderer.buildAttrs(
        schema,
        ctx,
        resolvedComponent,
        props.modelPathStack,
        nodeContext,
        parentMap
      )

      // 处理 show
      const finalAttrs = { ...attrs }
      if (schema.show && !showValue.value) {
        const currentStyle = finalAttrs.style
        if (typeof currentStyle === 'string') {
          finalAttrs.style = { ...parseStyleString(currentStyle, false), display: 'none' }
        } else {
          finalAttrs.style = { ...(currentStyle || {}), display: 'none' }
        }
      }

      // 解析子节点
      const children = renderer.resolveChildren(
        schema,
        ctx,
        currentModelPathStack.value,
        parentMap,
        path
      )

      // 处理 children 格式
      let finalChildren: any = null
      if (children && typeof children === 'object' && !Array.isArray(children)) {
        finalChildren = children
      } else if (children !== undefined && children !== null) {
        const isNativeElement = typeof resolvedComponent === 'string'
        if (isNativeElement) {
          finalChildren = children
        } else {
          finalChildren = { default: () => children }
        }
      }

      // 通过插件创建 VNode（lifecycle/provide-inject 等走 wrapComponent）
      const vueSchema = schema as VueSchemaNode
      let vnode: VNode

      const wrapped = renderer.wrapComponent?.(resolvedComponent, finalAttrs, finalChildren, vueSchema, ctx)
      if (wrapped) {
        vnode = wrapped
      } else {
        try {
          vnode = h(resolvedComponent, finalAttrs, finalChildren)
        } catch (error) {
          return h('div', { style: 'color: red; padding: 10px;' }, `Failed to render "${schema.type}": ${error}`)
        }
      }

      // 处理 ref
      if (vueSchema.ref && renderer.attachRef) {
        vnode = renderer.attachRef(vnode, vueSchema, ctx)
      }

      // 通过插件装饰 VNode（keepAlive/transition/teleport 等）
      if (renderer.decorateVNode) {
        vnode = renderer.decorateVNode(vnode, vueSchema, ctx)
      }

      return vnode
    }
  }
})

/**
 * 创建 VarioNode 的 VNode
 * 便捷工厂函数
 */
export function createVarioNodeVNode(
  schema: SchemaNode,
  ctx: RuntimeContext,
  path: string,
  renderer: VarioNodeRenderer,
  options: {
    modelPathStack?: PathSegment[]
    nodeContext?: NodeContext
    parentMap?: ParentMap
    depth?: number
    key?: string | number
  } = {}
): VNode {
  return h(VarioNode, {
    schema,
    ctx,
    path,
    renderer,
    modelPathStack: options.modelPathStack ?? [],
    nodeContext: options.nodeContext,
    parentMap: options.parentMap,
    depth: options.depth ?? 0,
    key: options.key ?? path
  })
}