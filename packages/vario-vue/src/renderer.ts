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

import { h, withDirectives, type VNode, type Directive, Fragment, ComponentInternalInstance, type App } from 'vue'
import type { SchemaNode } from '@variojs/schema'
import type { RuntimeContext, PathSegment } from '@variojs/types'
import { attachRef, RefsRegistry } from './features/refs.js'
import { ModelPathResolver } from './features/path-resolver.js'
import { ComponentResolver } from './features/component-resolver.js'
import { ExpressionEvaluator } from './features/expression-evaluator.js'
import { EventHandler } from './features/event-handler.js'
import { DirectiveHandler } from './features/directive-handler.js'
import { AttrsBuilder } from './features/attrs-builder.js'
import { LoopHandler } from './features/loop-handler.js'
import { ChildrenResolver } from './features/children-resolver.js'
import { parseStyleString } from './features/style-utils.js'
import type { VNodePlugin } from './plugins/types.js'
import { defaultPlugins } from './plugins/index.js'
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
import { createWeightCache, type WeightCache } from './features/schema-weight.js'
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
 *
 * 性能优化说明：渲染器内部基于 Scope-Weight Hybrid 策略自适应管理组件化决策：
 * - path-memo 始终开启，缓存静态子树
 * - 子树组件化：在响应式 scope boundary 且子树权重 > COMPONENT_OVERHEAD 时自动拆分
 * - 循环项组件化：当循环模板权重 > COMPONENT_OVERHEAD 时自动包装 LoopItemCell
 * 无需手动配置，系统内部根据 schema 结构自动形成最优解。
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
  /** VNode 插件列表，默认使用 defaultPlugins（lifecycle/keepAlive/transition/teleport） */
  plugins?: VNodePlugin[]
}

/**
 * Vue 渲染器
 * 将 Vario Schema 转换为 Vue VNode
 */
export class VueRenderer implements VarioNodeRenderer {
  public refsRegistry: RefsRegistry
  private instance: ComponentInternalInstance | null
  private getState?: () => any
  /** path-memo：按 path 缓存子树 VNode，未变分支复用（始终开启） */
  private pathMemoCache: PathMemoCache
  /** Schema Store（用于精确失效，内部管理） */
  private schemaStore?: SchemaStore
  /** Scope-Weight 权重缓存（WeakMap，schema GC 自动清理） */
  private weightCache: WeightCache

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
  /** VNode 插件（组件包装 + VNode 装饰） */
  private plugins: VNodePlugin[]

  /**
   * 稳定的 parentMap 引用（方案 C 优化）
   * 使用实例级别 WeakMap，避免 render() 每次创建新 WeakMap
   * 导致 VarioNode 的 parentMap prop 引用变化→触发不必要的级联重渲染。
   * WeakMap 的 GC 特性保证：旧 schema 对象被回收后，对应条目自动清理。
   */
  private _stableParentMap: ParentMap = new WeakMap()

  constructor(options: VueRendererOptions = {}) {
    this.instance = options.instance || null
    this.getState = options.getState
    this.refsRegistry = options.refsRegistry || new RefsRegistry()
    // 初始化功能模块
    // 合并全局组件：app / instance 上下文的全局组件作为基础，options.components 覆盖同名组件
    const appComponents =
      options.app?._context?.components ||
      options.instance?.appContext?.components ||
      {}
    const globalComponents = options.components
      ? { ...appComponents, ...options.components }
      : appComponents
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
    this.plugins = options.plugins ?? defaultPlugins
    this.pathMemoCache = new PathMemoCache()
    this.weightCache = createWeightCache()

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
    // 缓存 renderNodeForLoopItem 闭包：避免 parentMap 引用稳定后
    // 仍因闭包重建导致 LoopItemCell 的 renderNode prop 变化而级联重渲染
    const renderNodeCache = new WeakMap<ParentMap, (
      s: SchemaNode, c: RuntimeContext, stack: PathSegment[],
      nc: NodeContext | undefined, p: string
    ) => VNode>()
    const getRenderNodeForLoopItem = (parentMap: ParentMap) => {
      let cached = renderNodeCache.get(parentMap)
      if (!cached) {
        cached = (
          s: SchemaNode,
          c: RuntimeContext,
          stack: PathSegment[],
          nc: NodeContext | undefined,
          p: string
        ) => this.createVNode(s, c, stack, nc, parentMap, p)
        renderNodeCache.set(parentMap, cached)
      }
      return cached
    }
    this.loopHandler = new LoopHandler(
      this.pathResolver,
      createVNodeFn,
      (expr, ctx) => this.expressionEvaluator.evaluateExpr(expr, ctx),
      getRenderNodeForLoopItem,
      this.weightCache
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
    // 复用稳定的 parentMap 引用，避免 VarioNode 因 parentMap prop 变化而级联重渲染
    // WeakMap 中旧 schema 节点的条目由 GC 自动清理；
    // 当前 render 中 createVNode 会覆写同一 schema 节点的条目，保证正确性
    const vnode = this.createVNode(schema, ctx, [], undefined, this._stableParentMap, '')
    // 如果返回 null，返回一个空的 Fragment 作为占位符
    // Vue 需要有效的 VNode，不能是 null
    if (vnode === null || vnode === undefined) {
      return h(Fragment, null, [])
    }
    return vnode
  }

  /**
   * 创建 VNode — 渲染管线
   *
   * 每个阶段职责单一：校验 → parentMap → cond → show → memo → componentize → loop
   * → resolve → model → attrs → children → show-style → slots → lifecycle → h() → decorators → cache
   *
   * @param path  节点在 schema 树中的路径（如 ""、"0"、"0.1"、"0.[2]"），供 path-memo 缓存
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
    // ── 1. 校验 ──
    if (!schema || typeof schema !== 'object') {
      return this.createErrorVNode('Invalid schema')
    }
    if (!schema.type) {
      return this.createErrorVNode('Schema missing type property')
    }

    // ── 2. parentMap 注册 ──
    this.registerParentMap(schema, nodeContext, parentMap)

    // ── 3. 条件渲染（cond） ──
    const condValue = this.evaluateCond(schema, ctx)
    if (condValue === null) return null as any  // cond 为 false
    if (condValue instanceof Error) {
      return this.createErrorVNode(`Condition evaluation error: ${condValue.message}`, true)
    }

    // ── 4. show 求值 ──
    const showValue = this.evaluateShow(schema, ctx)

    // ── 5. path-memo 缓存命中 ──
    const canMemo = this.canMemoize(schema, path)
    if (canMemo) {
      const cached = this.tryGetMemoCache(schema, path, condValue, showValue)
      if (cached) return cached
    }

    // ── 6. Scope-Weight 子树组件化 ──
    if (shouldComponentize(schema, this.weightCache)) {
      return createVarioNodeVNode(schema, ctx, path, this, {
        modelPathStack, nodeContext, parentMap, depth, key: path || undefined
      })
    }

    // ── 7. loop 处理 ──
    if (schema.loop) {
      return this.loopHandler.createLoopVNode(schema, ctx, modelPathStack, parentMap, path) || null as any
    }

    // ── 8. 组件解析 ──
    const component = this.componentResolver.resolveComponent(schema.type)
    if (!component) {
      return this.createErrorVNode(`Component "${schema.type}" not found`)
    }

    // ── 9. model 路径栈更新 ──
    const { currentModelPathStack, scopePath } = this.resolveModelStack(schema, modelPathStack, ctx)

    // ── 10. 构建 attrs + children ──
    let attrs = this.attrsBuilder.buildAttrs(
      schema, ctx, component, modelPathStack,
      (props, rctx) => this.childrenResolver.evalProps(props, rctx),
      scopePath ? currentModelPathStack : undefined,
      nodeContext, parentMap
    )
    const children = this.childrenResolver.resolveChildren(schema, ctx, currentModelPathStack, parentMap, path)

    // ── 11. show → display:none ──
    if (schema.show) {
      attrs = this.applyShowDirective(attrs, showValue, schema)
    }

    // ── 12. slots 规范化 + lifecycle → h() ──
    const vueSchema = schema as VueSchemaNode
    const finalChildren = this.normalizeChildren(children, component)
    let vnode = this.createComponentVNode(component, attrs || {}, finalChildren, vueSchema, ctx)

    // ── 13. 后处理装饰器 ──
    vnode = this.applyVNodeDecorators(vnode, schema, vueSchema, ctx)

    // ── 14. path-memo 写入 ──
    if (canMemo) {
      this.setMemoCache(schema, path, condValue, showValue, vnode)
    }

    return vnode
  }

  // ============================================================================
  // createVNode 管线阶段方法
  // ============================================================================

  /** 注册 parentMap（节点→父节点映射） */
  private registerParentMap(schema: SchemaNode, nodeContext?: NodeContext, parentMap?: ParentMap): void {
    if (parentMap == null) return
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

  /** 求值 cond 表达式。返回 truthy 值 / null（false）/ Error */
  private evaluateCond(schema: SchemaNode, ctx: RuntimeContext): unknown | null | Error {
    if (!schema.cond) return true
    try {
      const val = this.expressionEvaluator.evaluateExpr(schema.cond, ctx)
      return val ? val : null
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error))
    }
  }

  /** 求值 show 表达式 */
  private evaluateShow(schema: SchemaNode, ctx: RuntimeContext): unknown {
    if (!schema.show) return true
    try {
      return this.expressionEvaluator.evaluateExpr(schema.show, ctx)
    } catch {
      return true
    }
  }

  /** 判断节点是否可 path-memo 缓存 */
  private canMemoize(schema: SchemaNode, path: string): boolean {
    const isLoopItem = path.includes('[')
    return !schema.loop && !isLoopItem
      && !hasLoopInSubtree(schema)
      && !hasModelInSubtree(schema)
      && !hasExpressionInSubtree(schema)
  }

  /** 尝试从 path-memo 缓存获取 VNode */
  private tryGetMemoCache(schema: SchemaNode, path: string, condValue: unknown, showValue: unknown): VNode | undefined {
    const cacheKey = getCacheKey(path, buildSchemaId(schema), buildDepsKey(condValue, showValue))
    return this.pathMemoCache.get(cacheKey)
  }

  /** 写入 path-memo 缓存 */
  private setMemoCache(schema: SchemaNode, path: string, condValue: unknown, showValue: unknown, vnode: VNode): void {
    const cacheKey = getCacheKey(path, buildSchemaId(schema), buildDepsKey(condValue, showValue))
    this.pathMemoCache.set(cacheKey, vnode)
  }

  /** 解析 model 路径栈 */
  private resolveModelStack(
    schema: SchemaNode,
    modelPathStack: PathSegment[],
    ctx: RuntimeContext
  ): { currentModelPathStack: PathSegment[]; scopePath: string | undefined } {
    const scopePath = this.pathResolver.getScopePath(schema.model)
    const currentModelPathStack = scopePath
      ? this.pathResolver.updateModelPathStack(scopePath, modelPathStack, ctx, schema)
      : [...modelPathStack]
    return { currentModelPathStack, scopePath }
  }

  /** 规范化 children：作用域插槽直传，组件用函数插槽，原生元素直传 */
  private normalizeChildren(children: any, component: any): any {
    if (children == null || children === undefined) return null
    if (typeof children === 'object' && !Array.isArray(children)) return children  // 作用域插槽
    return typeof component === 'string' ? children : { default: () => children }
  }

  /** 创建 VNode：先尝试 wrapComponent 插件，否则直接 h() */
  private createComponentVNode(
    component: any,
    attrs: Record<string, any>,
    children: any,
    vueSchema: VueSchemaNode,
    ctx: RuntimeContext
  ): VNode {
    // 遍历插件的 wrapComponent 阶段（第一个匹配即生效）
    for (const plugin of this.plugins) {
      if (!plugin.wrapComponent) continue
      const result = plugin.wrapComponent(component, attrs, children, vueSchema, ctx)
      if (result !== null) return result
    }
    try {
      return h(component, attrs, children)
    } catch (error) {
      return this.createErrorVNode(`Failed to render "${vueSchema.type}": ${error}`)
    }
  }

  // ============================================================================
  // 渲染管线辅助方法
  // ============================================================================

  /**
   * 创建错误提示 VNode
   */
  private createErrorVNode(message: string, withBorder = false): VNode {
    const style = withBorder
      ? 'color: red; padding: 10px; border: 1px solid red;'
      : 'color: red; padding: 10px;'
    return h('div', { style }, message)
  }

  /**
   * 应用 show 指令：根据 showValue 设置 display: none
   */
  private applyShowDirective(
    attrs: Record<string, any>,
    showValue: unknown,
    schema: SchemaNode
  ): Record<string, any> {
    try {
      if (showValue) return attrs
      const currentStyle = attrs.style
      if (typeof currentStyle === 'string') {
        return { ...attrs, style: { ...parseStyleString(currentStyle, false), display: 'none' } }
      }
      return { ...attrs, style: { ...(currentStyle as Record<string, any> || {}), display: 'none' } }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn(`Show expression evaluation error: ${errorMessage}`, schema)
      return { ...attrs, style: { ...(attrs.style as Record<string, any> || {}), display: 'none' } }
    }
  }

  /**
   * 应用 VNode 装饰器：ref → directives → 插件(decorateVNode)
   * ref 和 directives 是 schema 核心能力，始终内置；
   * 其余 Vue 特性（keepAlive/transition/teleport）由插件按注册顺序装饰。
   */
  private applyVNodeDecorators(
    vnode: VNode,
    schema: SchemaNode,
    vueSchema: VueSchemaNode,
    ctx: RuntimeContext
  ): VNode {
    // ref（核心）
    if (vueSchema.ref) {
      vnode = attachRef(vnode, vueSchema, this.refsRegistry, this.instance)
    }

    // 自定义指令（核心）
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

    // 插件装饰阶段
    for (const plugin of this.plugins) {
      if (!plugin.decorateVNode) continue
      vnode = plugin.decorateVNode(vnode, vueSchema, ctx)
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
   * 通过插件尝试包装组件（VarioNode 接口）
   */
  wrapComponent(
    component: any,
    attrs: Record<string, any>,
    children: any,
    vueSchema: VueSchemaNode,
    ctx: RuntimeContext
  ): VNode | null {
    for (const plugin of this.plugins) {
      if (!plugin.wrapComponent) continue
      const result = plugin.wrapComponent(component, attrs, children, vueSchema, ctx)
      if (result !== null) return result
    }
    return null
  }

  /**
   * 通过插件装饰 VNode（VarioNode 接口）
   */
  decorateVNode(
    vnode: VNode,
    vueSchema: VueSchemaNode,
    ctx: RuntimeContext
  ): VNode {
    for (const plugin of this.plugins) {
      if (!plugin.decorateVNode) continue
      vnode = plugin.decorateVNode(vnode, vueSchema, ctx)
    }
    return vnode
  }

  /**
   * 附加 ref
   */
  attachRef(vnode: VNode, vueSchema: VueSchemaNode): VNode {
    return attachRef(vnode, vueSchema, this.refsRegistry, this.instance)
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
   * 初始化 Schema Store（内部使用，用于 query API 的 patch 能力）
   */
  initSchemaStore(schema: SchemaNode): void {
    this.schemaStore = createSchemaStore()
    this.schemaStore.fromTree(schema)
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
