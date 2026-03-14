/**
 * 方案 C：子树组件化（Scope-Weight Hybrid）
 *
 * 核心思路：
 * - 在「响应式作用域边界」且「子树权重 > 组件开销」的节点自动包装为 VarioNode
 * - 组件化位置由 isScopeBoundary + computeWeight 共同决定
 * - 一个参数（COMPONENT_OVERHEAD）映射到物理量（组件实例等价 VNode 成本）
 *
 * 用户写法完全不变，内部架构优化
 */

import {
  defineComponent,
  h,
  computed,
  type VNode,
  type PropType,
  Transition,
  KeepAlive
} from 'vue'
import type { SchemaNode } from '@variojs/schema'
import type { RuntimeContext, PathSegment } from '@variojs/core'
import type { NodeContext, ParentMap } from './node-context.js'
import type { VueSchemaNode } from '../types.js'
import { isScopeBoundary, computeWeight, COMPONENT_OVERHEAD, type WeightCache } from './schema-weight.js'

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
  /** 处理生命周期 */
  createComponentWithLifecycle?: (
    component: any,
    attrs: Record<string, any>,
    children: any,
    vueSchema: VueSchemaNode,
    ctx: RuntimeContext
  ) => VNode
  /** 附加 ref */
  attachRef?: (vnode: VNode, vueSchema: VueSchemaNode) => VNode
  /** 获取 model 路径栈更新 */
  getUpdatedModelPathStack?: (
    schema: SchemaNode,
    modelPathStack: PathSegment[],
    ctx: RuntimeContext
  ) => PathSegment[]
}

/**
 * @deprecated 保留类型以兼容旧测试，内部已不再使用手动配置
 */
export interface SubtreeComponentOptions {
  enabled?: boolean
  granularity?: 'all' | 'boundary'
  maxDepth?: number
}

/**
 * 判断是否应该组件化该节点（方案 C：Scope-Weight Hybrid）
 *
 * 决策公式：
 *   shouldComponentize = !loop && isScopeBoundary(node) && weight(node) > COMPONENT_OVERHEAD
 *
 * 特殊规则：
 * 1. 含 loop 的节点必须由 LoopHandler 在 createVNode 层面处理，不可组件化
 * 2. 有 lifecycle/provide/inject 的节点始终组件化（需要独立 setup 环境）
 * 3. 其他 scope boundary（model 绑定、自定义组件）只在权重 > COMPONENT_OVERHEAD 时组件化
 *
 * @param schema   当前 schema 节点
 * @param weightCache  子树权重缓存（WeakMap，跨 render 复用）
 */
export function shouldComponentize(
  schema: SchemaNode,
  weightCache: WeightCache
): boolean {
  // 含 loop 的节点不可组件化：LoopHandler 需要在 renderer.createVNode 层面
  // 展开循环、创建 LoopItemCell 等，VarioNode 无法处理此逻辑。
  if (schema.loop) return false

  const s = schema as Record<string, unknown>
  const hasLifecycle = !!(s.onMounted || s.provide || s.inject)

  // 有生命周期/provide/inject 的节点始终组件化（需要独立 setup 环境）
  if (hasLifecycle) return true

  // 非 scope boundary → 永不组件化
  if (!isScopeBoundary(schema)) return false

  // scope boundary + weight > COMPONENT_OVERHEAD → 组件化有净收益
  const weight = computeWeight(schema, weightCache)
  return weight > COMPONENT_OVERHEAD
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
    // 使用 computed 缓存条件求值结果
    const condValue = computed(() => {
      if (!props.schema.cond) return true
      try {
        return props.renderer.evaluateExpr(props.schema.cond, props.ctx)
      } catch {
        return false
      }
    })

    // 使用 computed 缓存 show 求值结果
    const showValue = computed(() => {
      if (!props.schema.show) return true
      try {
        return props.renderer.evaluateExpr(props.schema.show, props.ctx)
      } catch {
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
      const attrs = renderer.buildAttrs(
        schema,
        ctx,
        resolvedComponent,
        currentModelPathStack.value,
        nodeContext,
        parentMap
      )

      // 处理 show
      const finalAttrs = { ...attrs }
      if (schema.show && !showValue.value) {
        const currentStyle = finalAttrs.style
        if (typeof currentStyle === 'string') {
          const styleObj: Record<string, string> = {}
          currentStyle.split(';').forEach((rule: string) => {
            const [key, value] = rule.split(':').map((s: string) => s.trim())
            if (key && value) {
              styleObj[key] = value
            }
          })
          finalAttrs.style = { ...styleObj, display: 'none' }
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

      // 检查是否需要生命周期包装
      const vueSchema = schema as VueSchemaNode
      const hasLifecycle = vueSchema.onMounted || vueSchema.onUnmounted || vueSchema.onUpdated ||
                           vueSchema.onBeforeMount || vueSchema.onBeforeUnmount || vueSchema.onBeforeUpdate
      const hasProvideInject = (vueSchema.provide && Object.keys(vueSchema.provide).length > 0) ||
                               (vueSchema.inject && (Array.isArray(vueSchema.inject) ? vueSchema.inject.length > 0 : Object.keys(vueSchema.inject).length > 0))

      let vnode: VNode

      if ((hasLifecycle || hasProvideInject) && renderer.createComponentWithLifecycle) {
        vnode = renderer.createComponentWithLifecycle(resolvedComponent, finalAttrs, finalChildren, vueSchema, ctx)
      } else {
        try {
          vnode = h(resolvedComponent, finalAttrs, finalChildren)
        } catch (error) {
          return h('div', { style: 'color: red; padding: 10px;' }, `Failed to render "${schema.type}": ${error}`)
        }
      }

      // 处理 ref
      if (vueSchema.ref && renderer.attachRef) {
        vnode = renderer.attachRef(vnode, vueSchema)
      }

      // 处理 keep-alive
      if (vueSchema.keepAlive) {
        const keepAliveProps = typeof vueSchema.keepAlive === 'object' ? vueSchema.keepAlive : {}
        vnode = h(KeepAlive, keepAliveProps, () => vnode)
      }

      // 处理 transition
      if (vueSchema.transition) {
        const transitionProps = typeof vueSchema.transition === 'string'
          ? { name: vueSchema.transition }
          : { ...vueSchema.transition }
        vnode = h(Transition, transitionProps as any, () => vnode)
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
