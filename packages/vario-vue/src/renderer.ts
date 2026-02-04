/**
 * Vue renderer implementation
 * 
 * 功能：
 * - Schema → VNode 转换
 * - 通用组件解析（支持全局注册的组件）
 * - 双向绑定处理
 * - 控制流转换（cond/show/loop）
 * - 事件处理
 * - 表达式求值
 */

import { h, withDirectives, type VNode, type Directive, Fragment, ComponentInternalInstance, Transition, KeepAlive, type App } from 'vue'
import type { SchemaNode } from '@variojs/schema'
import type { RuntimeContext, PathSegment } from '@variojs/types'
import { attachRef, RefsRegistry } from './features/refs.js'
import { createTeleport, shouldTeleport } from './features/teleport.js'
import { ModelPathResolver } from './features/path-resolver.js'
import { ComponentResolver } from './features/component-resolver.js'
import { ExpressionEvaluator } from './features/expression-evaluator.js'
import { EventHandler } from './features/event-handler.js'
import { DirectiveHandler } from './features/directive-handler.js'
import { AttrsBuilder } from './features/attrs-builder.js'
import { LoopHandler } from './features/loop-handler.js'
import { ChildrenResolver } from './features/children-resolver.js'
import { LifecycleWrapper } from './features/lifecycle-wrapper.js'
import type { NodeContext } from './features/node-context.js'
import type { ParentMap } from './features/node-context.js'
import {
  PathMemoCache,
  buildSchemaId,
  buildDepsKey,
  getCacheKey,
  hasLoopInSubtree,
  hasModelInSubtree,
  hasExpressionInSubtree
} from './features/path-memo.js'
import { shouldComponentize, type VarioNodeRenderer, createVarioNodeVNode } from './features/vario-node.js'
import { createSchemaStore, type SchemaStore } from './features/schema-store.js'
import type { VueSchemaNode } from './types.js'

/**
 * Model 绑定相关配置（供外部/扩展使用）
 */
export interface ModelOptions {
  /** 路径分隔符，默认 '.'，可供自定义路径格式 */
  separator?: string
  /** 整棵 schema 的 model 默认惰性：true 时所有未显式设置 lazy 的 model 均不预写 state */
  lazy?: boolean
}

/**
 * Vue 渲染器配置
 */
export interface VueRendererOptions {
  instance?: ComponentInternalInstance | null
  /** Vue 应用实例（用于获取全局组件，优先级高于 instance） */
  app?: App | null
  /** 全局组件映射（用于获取全局组件，优先级最高） */
  components?: Record<string, any>
  /** 自定义指令映射（支持用户注册指令） */
  directives?: Record<string, Directive>
  getState?: () => any  // 用于创建响应式绑定的状态获取函数
  refsRegistry?: RefsRegistry  // Refs 注册表
  modelOptions?: ModelOptions  // Model 绑定配置（路径分隔符、默认惰性）
  /** 是否启用 path-memo 缓存（默认 true），设为 false 可做升级前基准对比 */
  usePathMemo?: boolean
  /** 是否对 loop 每项使用独立 Vue 组件（列表项组件化），默认 false；开启后仅该项 props 变化时 re-render */
  loopItemAsComponent?: boolean
  /** 方案 C：子树组件化配置 */
  subtreeComponent?: {
    /** 是否启用子树组件化（默认 false） */
    enabled?: boolean
    /** 组件化粒度：'all' 所有节点 | 'boundary' 仅组件边界 */
    granularity?: 'all' | 'boundary'
    /** 最大深度（超过后不再组件化） */
    maxDepth?: number
  }
  /** 方案 D：Schema 碎片化配置 */
  schemaFragment?: {
    /** 是否启用碎片化（默认 false） */
    enabled?: boolean
    /** 碎片粒度：'node' 每个节点 | 'component' 仅组件边界 */
    granularity?: 'node' | 'component'
  }
}

/**
 * Vue 渲染器
 * 将 Vario Schema 转换为 Vue VNode
 */
export class VueRenderer implements VarioNodeRenderer {
  public refsRegistry: RefsRegistry
  private getState?: () => any
  /** path-memo：按 path 缓存子树 VNode，未变分支复用 */
  private pathMemoCache: PathMemoCache
  private usePathMemo: boolean
  private loopItemAsComponent: boolean
  /** 方案 C：子树组件化配置 */
  public readonly subtreeComponentOptions: { enabled: boolean; granularity: 'all' | 'boundary'; maxDepth?: number }
  /** 方案 D：Schema 碎片化配置 */
  public readonly schemaFragmentOptions: { enabled: boolean; granularity: 'node' | 'component' }
  /** 方案 D：Schema Store（用于精确失效） */
  private schemaStore?: SchemaStore

  // 功能模块
  private pathResolver: ModelPathResolver
  private componentResolver: ComponentResolver
  private expressionEvaluator: ExpressionEvaluator
  private eventHandler: EventHandler
  private directiveHandler: DirectiveHandler
  private directiveMap: Map<string, Directive>
  private attrsBuilder: AttrsBuilder
  private loopHandler: LoopHandler
  private childrenResolver: ChildrenResolver
  private lifecycleWrapper: LifecycleWrapper

  constructor(options: VueRendererOptions = {}) {
    this.getState = options.getState
    this.refsRegistry = options.refsRegistry || new RefsRegistry()
    // 初始化功能模块
    // 优先级：components > app._context.components > instance?.appContext?.components
    const globalComponents = 
      options.components ||
      options.app?._context?.components ||
      options.instance?.appContext?.components ||
      {}
    this.componentResolver = new ComponentResolver(globalComponents)
    this.expressionEvaluator = new ExpressionEvaluator()
    this.eventHandler = new EventHandler((expr, ctx) => this.expressionEvaluator.evaluateExpr(expr, ctx))
    this.directiveHandler = new DirectiveHandler((expr, ctx) => this.expressionEvaluator.evaluateExpr(expr, ctx))
    
    // 初始化指令映射表并注册内置指令
    this.directiveMap = new Map()
    DirectiveHandler.registerBuiltInDirectives(this.directiveMap)
    
    // 注册用户自定义指令
    if (options.directives) {
      Object.entries(options.directives).forEach(([name, directive]) => {
        this.directiveMap.set(name, directive)
      })
    }
    
    this.pathResolver = new ModelPathResolver((expr, ctx) =>
      this.expressionEvaluator.evaluateExpr(expr, ctx)
    )
    this.attrsBuilder = new AttrsBuilder(
      this.getState,
      this.pathResolver,
      this.eventHandler,
      options.modelOptions?.lazy
    )
    this.lifecycleWrapper = new LifecycleWrapper()
    this.pathMemoCache = new PathMemoCache()
    this.usePathMemo = options.usePathMemo !== false
    this.loopItemAsComponent = options.loopItemAsComponent === true
    
    // 方案 C：子树组件化配置
    this.subtreeComponentOptions = {
      enabled: options.subtreeComponent?.enabled === true,
      granularity: options.subtreeComponent?.granularity ?? 'boundary',
      maxDepth: options.subtreeComponent?.maxDepth
    }
    
    // 方案 D：Schema 碎片化配置
    this.schemaFragmentOptions = {
      enabled: options.schemaFragment?.enabled === true,
      granularity: options.schemaFragment?.granularity ?? 'node'
    }

    // LoopHandler 和 ChildrenResolver 需要 createVNode，支持 nodeContext / parentMap / path（path-memo）
    const createVNodeFn = (
      schema: SchemaNode,
      ctx: RuntimeContext,
      modelPathStack?: PathSegment[],
      nodeContext?: NodeContext,
      parentMap?: ParentMap,
      path?: string
    ) =>
      this.createVNode(schema, ctx, modelPathStack ?? [], nodeContext, parentMap, path ?? nodeContext?.path ?? '')
    const getRenderNodeForLoopItem = (parentMap: ParentMap) => (
      s: SchemaNode,
      c: RuntimeContext,
      stack: PathSegment[],
      nc: NodeContext | undefined,
      p: string
    ) => this.createVNode(s, c, stack, nc, parentMap, p)
    this.loopHandler = new LoopHandler(
      this.pathResolver,
      createVNodeFn,
      (expr, ctx) => this.expressionEvaluator.evaluateExpr(expr, ctx),
      this.loopItemAsComponent,
      getRenderNodeForLoopItem
    )
    this.childrenResolver = new ChildrenResolver(
      createVNodeFn,
      this.expressionEvaluator
    )
  }

  /**
   * 渲染 Schema 为 VNode
   */
  render(schema: SchemaNode, ctx: RuntimeContext): VNode | null {
    const parentMap: ParentMap = new WeakMap()
    const vnode = this.createVNode(schema, ctx, [], undefined, parentMap, '')
    // 如果返回 null，返回一个空的 Fragment 作为占位符
    // Vue 需要有效的 VNode，不能是 null
    if (vnode === null || vnode === undefined) {
      return h(Fragment, null, [])
    }
    return vnode
  }

  /**
   * 创建 VNode
   * @param path 节点在 schema 树中的路径（如 ""、"0"、"0.1"、"0.[2]"），供 path-memo 缓存
   * @param depth 当前节点深度（从 0 开始），用于方案 C 子树组件化
   */
  private createVNode(
    schema: SchemaNode | VueSchemaNode,
    ctx: RuntimeContext,
    modelPathStack: PathSegment[] = [],
    nodeContext?: NodeContext,
    parentMap?: ParentMap,
    path: string = '',
    depth: number = 0
  ): VNode {
    if (!schema || typeof schema !== 'object') {
      return h('div', { style: 'color: red; padding: 10px;' }, 'Invalid schema')
    }
    if (!schema.type) {
      return h('div', { style: 'color: red; padding: 10px;' }, 'Schema missing type property')
    }

    if (parentMap != null) {
      if (nodeContext == null) {
        parentMap.set(schema, null)
      } else {
        parentMap.set(schema, nodeContext.parent ?? null)
        const siblings = nodeContext.siblings ?? []
        const parent = nodeContext.parent
        if (parent != null) {
          siblings.forEach(s => parentMap!.set(s, parent))
        }
      }
    }

    // 处理条件渲染（优化：提前返回，避免不必要的处理）
    let condValue: unknown = true
    if (schema.cond) {
      try {
        condValue = this.expressionEvaluator.evaluateExpr(schema.cond, ctx)
        if (!condValue) {
          return null as any
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return h('div', { 
          style: 'color: red; padding: 10px; border: 1px solid red;' 
        }, `Condition evaluation error: ${errorMessage}`)
      }
    }

    // show 求值（用于 path-memo 依赖键，后续 attrs 也会用到）
    let showValue: unknown = true
    try {
      if (schema.show) {
        showValue = this.expressionEvaluator.evaluateExpr(schema.show, ctx)
      }
    } catch {
      showValue = true
    }

    // path-memo：不含 loop/model/expression 子树的节点且非循环项时才缓存
    // - 含 model 时缓存会返回旧 value，导致双向绑定失效
    // - 含表达式时缓存会返回旧 VNode，导致 state 变化后 props/children 无法更新
    const isLoopItem = path.includes('[')
    const noLoopInSubtree = !hasLoopInSubtree(schema)
    const noModelInSubtree = !hasModelInSubtree(schema)
    const noExpressionInSubtree = !hasExpressionInSubtree(schema)
    const canMemo = this.usePathMemo && !schema.loop && !isLoopItem && noLoopInSubtree && noModelInSubtree && noExpressionInSubtree
    if (canMemo) {
      const schemaId = buildSchemaId(schema)
      const depsKey = buildDepsKey(condValue, showValue)
      const cacheKey = getCacheKey(path, schemaId, depsKey)
      const cached = this.pathMemoCache.get(cacheKey)
      if (cached !== undefined) {
        return cached
      }
    }

    // 方案 C：子树组件化 - 符合条件时使用 VarioNode 渲染
    // 这样每个组件化的子树都是独立的 Vue 组件，props 不变时跳过 re-render
    if (shouldComponentize(schema, depth, this.subtreeComponentOptions)) {
      return createVarioNodeVNode(schema, ctx, path, this, {
        modelPathStack,
        nodeContext,
        parentMap,
        depth,
        key: path || undefined
      })
    }

    // 处理列表渲染
    if (schema.loop) {
      const loopVNode = this.loopHandler.createLoopVNode(schema, ctx, modelPathStack, parentMap, path)
      return loopVNode || null as any
    }

    // 解析组件（先解析，用于双向绑定的自动检测）
    const component = this.componentResolver.resolveComponent(schema.type)
    
    // 确保 component 有效
    if (!component) {
      return h('div', { style: 'color: red; padding: 10px;' }, `Component "${schema.type}" not found`)
    }
    
    // 处理 Vue 特有的扩展
    const vueSchema = schema as VueSchemaNode
    
    // 处理 model 路径（更新路径栈，供子级使用）
    // model 为 string 或 object+scope 时压栈
    let currentModelPathStack = [...modelPathStack]
    const scopePath = this.pathResolver.getScopePath(schema.model)
    if (scopePath) {
      currentModelPathStack = this.pathResolver.updateModelPathStack(
        scopePath,
        modelPathStack,
        ctx,
        schema
      )
    }
    
    // 构建属性（传入 component、路径栈、nodeContext、parentMap）
    let attrs = this.attrsBuilder.buildAttrs(
      schema,
      ctx,
      component,
      modelPathStack,
      (props, ctx) => this.childrenResolver.evalProps(props, ctx),
      scopePath ? currentModelPathStack : undefined,
      nodeContext,
      parentMap
    )

    // 解析子节点（支持作用域插槽，传递路径栈、parentMap、path 供 path-memo）
    let children = this.childrenResolver.resolveChildren(
      schema,
      ctx,
      currentModelPathStack,
      parentMap,
      path
    )
    
    // 处理可见性控制（v-show，复用 path-memo 阶段求得的 showValue）
    if (schema.show) {
      try {
        const isVisible = !!showValue
        if (!isVisible) {
          // 确保 style 是对象格式
          const currentStyle = attrs.style
          if (typeof currentStyle === 'string') {
            // 如果 style 是字符串，转换为对象
            const styleObj: Record<string, string> = {}
            currentStyle.split(';').forEach(rule => {
              const [key, value] = rule.split(':').map(s => s.trim())
              if (key && value) {
                styleObj[key] = value
              }
            })
            attrs.style = { ...styleObj, display: 'none' }
          } else {
            // style 已经是对象或未定义
            attrs.style = { ...(currentStyle as Record<string, any> || {}), display: 'none' }
          }
        }
      } catch (error) {
        // 表达式求值错误，隐藏元素并显示错误提示
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.warn(`Show expression evaluation error: ${errorMessage}`, schema)
        // 默认隐藏元素
        attrs.style = { ...(attrs.style as Record<string, any> || {}), display: 'none' }
      }
    }
    
    // 确保 attrs 是对象（避免 undefined 导致的问题）
    const safeAttrs = attrs || {}
    
    // 处理 children：Vue 3 组件推荐使用函数插槽以获得更好的性能
    let finalAttrs = safeAttrs
    let finalChildren: any = null
    
    if (children && typeof children === 'object' && !Array.isArray(children)) {
      // 作用域插槽对象（已经是函数），直接使用
      finalChildren = children
    } else if (children !== undefined && children !== null) {
      // 普通 children：对于组件，包装成函数插槽以避免警告
      // 对于原生 DOM 元素，可以直接使用数组
      const isNativeElement = typeof component === 'string'
      if (isNativeElement) {
        finalChildren = children
      } else {
        // Vue 3 组件推荐使用函数插槽
        finalChildren = { default: () => children }
      }
    }
    
    // 检查是否需要组件包装（生命周期、provide/inject 都需要在 setup 中处理）
    const hasLifecycle = vueSchema.onMounted || vueSchema.onUnmounted || vueSchema.onUpdated || 
                         vueSchema.onBeforeMount || vueSchema.onBeforeUnmount || vueSchema.onBeforeUpdate
    const hasProvideInject = (vueSchema.provide && Object.keys(vueSchema.provide).length > 0) ||
                             (vueSchema.inject && (Array.isArray(vueSchema.inject) ? vueSchema.inject.length > 0 : Object.keys(vueSchema.inject).length > 0))
    
    let vnode: VNode
    
    if (hasLifecycle || hasProvideInject) {
      vnode = this.lifecycleWrapper.createComponentWithLifecycle(component, finalAttrs, finalChildren, vueSchema, ctx)
    } else {
      try {
        vnode = h(component, finalAttrs, finalChildren)
      } catch (error) {
        return h('div', { style: 'color: red; padding: 10px;' }, `Failed to render "${schema.type}": ${error}`)
      }
    }
    
    // 处理 ref
    if (vueSchema.ref) {
      vnode = attachRef(vnode, vueSchema, this.refsRegistry)
    }
    
    // 处理自定义指令（使用 withDirectives）
    if (schema.directives) {
      const directiveArgs = this.directiveHandler.toVueDirectiveArguments(
        schema.directives,
        ctx,
        this.directiveMap
      )
      if (directiveArgs && directiveArgs.length > 0) {
        vnode = withDirectives(vnode, directiveArgs)
      }
    }
    
    // 处理 keep-alive
    if (vueSchema.keepAlive) {
      const keepAliveProps = typeof vueSchema.keepAlive === 'object' 
        ? vueSchema.keepAlive 
        : {}
      vnode = h(KeepAlive, keepAliveProps, () => vnode)
    }
    
    // 处理 transition
    if (vueSchema.transition) {
      const transitionProps = typeof vueSchema.transition === 'string'
        ? { name: vueSchema.transition }
        : {
            ...vueSchema.transition,
            // 确保 duration 符合类型要求
            duration: vueSchema.transition.duration && typeof vueSchema.transition.duration === 'object'
              ? (vueSchema.transition.duration.enter && vueSchema.transition.duration.leave
                  ? { enter: vueSchema.transition.duration.enter, leave: vueSchema.transition.duration.leave }
                  : undefined)
              : vueSchema.transition.duration
          }
      vnode = h(Transition, transitionProps as any, () => vnode)
    }
    
    // 处理 teleport（必须在最外层）
    if (shouldTeleport(vueSchema.teleport)) {
      vnode = createTeleport(vueSchema.teleport, vnode)
    }

    // path-memo：不含 loop 子树的节点且非循环项时缓存子树 VNode
    if (canMemo) {
      const schemaId = buildSchemaId(schema)
      const depsKey = buildDepsKey(condValue, showValue)
      const cacheKey = getCacheKey(path, schemaId, depsKey)
      this.pathMemoCache.set(cacheKey, vnode)
    }

    return vnode
  }

  // ============================================================================
  // VarioNodeRenderer 接口实现（方案 C 需要）
  // ============================================================================

  /**
   * 解析组件类型
   */
  resolveComponent(type: string): any {
    return this.componentResolver.resolveComponent(type)
  }

  /**
   * 求值表达式
   */
  evaluateExpr(expr: string, ctx: RuntimeContext): unknown {
    return this.expressionEvaluator.evaluateExpr(expr, ctx)
  }

  /**
   * 构建属性
   */
  buildAttrs(
    schema: SchemaNode,
    ctx: RuntimeContext,
    component: any,
    modelPathStack: PathSegment[],
    nodeContext?: NodeContext,
    parentMap?: ParentMap
  ): Record<string, any> {
    const scopePath = this.pathResolver.getScopePath(schema.model)
    let currentModelPathStack = modelPathStack
    if (scopePath) {
      currentModelPathStack = this.pathResolver.updateModelPathStack(
        scopePath,
        modelPathStack,
        ctx,
        schema
      )
    }
    return this.attrsBuilder.buildAttrs(
      schema,
      ctx,
      component,
      modelPathStack,
      (props, ctx) => this.childrenResolver.evalProps(props, ctx),
      scopePath ? currentModelPathStack : undefined,
      nodeContext,
      parentMap
    )
  }

  /**
   * 解析子节点
   */
  resolveChildren(
    schema: SchemaNode,
    ctx: RuntimeContext,
    modelPathStack: PathSegment[],
    parentMap?: ParentMap,
    path?: string
  ): any {
    return this.childrenResolver.resolveChildren(schema, ctx, modelPathStack, parentMap, path)
  }

  /**
   * 处理生命周期包装
   */
  createComponentWithLifecycle(
    component: any,
    attrs: Record<string, any>,
    children: any,
    vueSchema: VueSchemaNode,
    ctx: RuntimeContext
  ): VNode {
    return this.lifecycleWrapper.createComponentWithLifecycle(component, attrs, children, vueSchema, ctx)
  }

  /**
   * 附加 ref
   */
  attachRef(vnode: VNode, vueSchema: VueSchemaNode): VNode {
    return attachRef(vnode, vueSchema, this.refsRegistry)
  }

  /**
   * 获取更新后的 model 路径栈
   */
  getUpdatedModelPathStack(
    schema: SchemaNode,
    modelPathStack: PathSegment[],
    ctx: RuntimeContext
  ): PathSegment[] {
    const scopePath = this.pathResolver.getScopePath(schema.model)
    if (scopePath) {
      return this.pathResolver.updateModelPathStack(scopePath, modelPathStack, ctx, schema)
    }
    return modelPathStack
  }

  // ============================================================================
  // 方案 D：Schema Store 相关方法
  // ============================================================================

  /**
   * 获取 Schema Store（方案 D）
   */
  getSchemaStore(): SchemaStore | undefined {
    return this.schemaStore
  }

  /**
   * 初始化 Schema Store（方案 D）
   */
  initSchemaStore(schema: SchemaNode): void {
    if (this.schemaFragmentOptions.enabled) {
      this.schemaStore = createSchemaStore()
      this.schemaStore.fromTree(schema)
    }
  }

  /**
   * 精确更新 Schema 节点（方案 D）
   */
  patchSchemaNode(path: string, patch: Partial<SchemaNode>): void {
    if (this.schemaStore) {
      this.schemaStore.patch(path, patch)
      // 清除相关 path-memo 缓存
      this.pathMemoCache.clear()
    }
  }

  /**
   * 清除组件解析缓存
   * 用于组件注册变更后的缓存失效
   */
  public clearComponentCache(): void {
    this.componentResolver.clearComponentCache()
  }

  /**
   * 清除 path-memo 缓存
   * 用于 schema 结构大变或需强制全量重算时
   */
  public clearPathMemoCache(): void {
    this.pathMemoCache.clear()
  }

  /**
   * 使特定组件的缓存失效
   */
  public invalidateComponentCache(type: string): void {
    this.componentResolver.invalidateComponentCache(type)
  }
}
