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
import {
  scanSchemaIterative,
  DEFAULT_MOUNT_MAX_DEPTH,
  SchemaDepthError,
  getOrCreateEngine,
  type DiagnosticSink
} from '@variojs/core'
import { emitPerformance } from './internal/performance-hooks.js'
import type { VNodePlugin } from './plugins/types.js'
import { defaultPlugins } from './plugins/index.js'
import type { NodeContext } from './features/node-context.js'
import type { ParentMap } from './features/node-context.js'
import { shouldComponentize, type VarioNodeRenderer, createVarioNodeVNode } from './features/vario-node.js'
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
 * 组件化策略：scope boundary 始终组件化（model 绑定 / 自定义组件 / lifecycle）。
 * 循环项含子节点时自动包装 LoopItemCell。Vue 组件级 diff 自动跳过未变组件。
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
  /** 页面级 model 配置，不写入全局 registerModelConfig */
  modelConfigs?: Map<string, import('./bindings.js').ModelConfig>
  regionInterceptor?: (schema: SchemaNode, path: string, ctx: RuntimeContext) => VNode | null | undefined
  diagnosticSink?: DiagnosticSink
  /** 显式运行时模式：决定表达式求值与事件作用域的路径（禁止用"能否查到 PageSession"推断） */
  runtimeMode?: 'legacy' | 'shadow' | 'prepared'
}

/**
 * Vue 渲染器
 * 将 Vario Schema 转换为 Vue VNode
 */
export class VueRenderer implements VarioNodeRenderer {
  public refsRegistry: RefsRegistry
  private instance: ComponentInternalInstance | null
  private getState?: () => any

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
  private sink?: DiagnosticSink
  private preparedByPlugin = new WeakSet<object>()
  /** 显式运行时模式（legacy 走 evaluate 旧缓存；prepared 走 plan+memo） */
  readonly runtimeMode: 'legacy' | 'shadow' | 'prepared'
  /** 深度扫描结果缓存（按 schema 引用；patch 时 invalidateScan 失效） */
  private scanCache = new WeakMap<SchemaNode, ReturnType<typeof scanSchemaIterative>>()
  regionInterceptor?: (schema: SchemaNode, path: string, ctx: RuntimeContext) => VNode | null | undefined

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
    this.runtimeMode = options.runtimeMode ?? 'legacy'
    this.refsRegistry = options.refsRegistry || new RefsRegistry()
    this.regionInterceptor = options.regionInterceptor
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
    this.expressionEvaluator = new ExpressionEvaluator(this.runtimeMode)
    this.eventHandler = new EventHandler(
      (expr, ctx) => this.expressionEvaluator.evaluateExpr(expr, ctx),
      this.runtimeMode
    )
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
      options.modelOptions?.lazy,
      options.modelConfigs
    )
    this.plugins = (options.plugins ?? defaultPlugins).slice()
    this.sink = options.diagnosticSink
    for (const plugin of this.plugins) {
      try {
        plugin.setup?.(getOrCreateEngine())
        this.sink?.emit({
          name: 'plugin-resolve',
          diagnostic: { code: plugin.name, message: 'plugin-resolve', path: '', phase: 'plugin' }
        })
      } catch (error) {
        this.sink?.emit({
          name: 'plugin-error',
          diagnostic: { code: plugin.name, message: 'plugin-error', path: '', phase: 'plugin' }
        })
        throw error
      }
    }

    // LoopHandler 和 ChildrenResolver 需要 createVNode
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
      getRenderNodeForLoopItem
    )
    this.childrenResolver = new ChildrenResolver(
      createVNodeFn,
      this.expressionEvaluator
    )
  }

  release(): void {
    this.getState = undefined
    this.regionInterceptor = undefined
    this.instance = null
    this.attrsBuilder.release()
    for (const plugin of this.plugins) {
      plugin.dispose?.()
    }
    this.plugins = []
    this.refsRegistry.clear()
  }

  /**
   * 使 schema 根的深度扫描缓存失效（patchNode / onSchemaPatch 后调用）
   */
  invalidateScan(root: SchemaNode): void {
    this.scanCache.delete(root)
  }

  /**
   * 渲染 Schema 为 VNode
   */
  render(schema: SchemaNode, ctx: RuntimeContext): VNode | null {
    // 深度扫描结果按 schema 引用缓存（schema patch 时调 invalidateScan 失效）
    let scan = this.scanCache.get(schema)
    if (!scan) {
      scan = scanSchemaIterative(schema)
      this.scanCache.set(schema, scan)
    }
    if (scan.maxDepth > DEFAULT_MOUNT_MAX_DEPTH) {
      throw new SchemaDepthError(
        `Schema depth ${scan.maxDepth} exceeds mount limit ${DEFAULT_MOUNT_MAX_DEPTH}`,
        {
          schemaPath: scan.maxPath,
          metadata: {
            phase: 'mount',
            node: scan.maxNode,
            path: scan.maxPath,
            actual: scan.maxDepth,
            limit: DEFAULT_MOUNT_MAX_DEPTH
          }
        }
      )
    }
    for (const plugin of this.plugins) {
      try {
        plugin.validate?.(schema as VueSchemaNode)
      } catch (error) {
        this.sink?.emit({
          name: 'plugin-error',
          diagnostic: { code: plugin.name, message: 'plugin-error', path: '', phase: 'plugin' }
        })
        throw error
      }
    }
    const vnode = this.createVNode(schema, ctx, [], undefined, this._stableParentMap, '')
    if (vnode === null || vnode === undefined) {
      return h(Fragment, null, [])
    }
    return vnode
  }

  /**
   * 创建 VNode — 渲染管线
   *
   * 校验 → parentMap → cond → show → componentize → loop → resolve → model
   * → attrs → children → show-style → slots → lifecycle → h() → decorators
   */
  private createVNode(
    schema: SchemaNode | VueSchemaNode,
    ctx: RuntimeContext,
    modelPathStack: PathSegment[] = [],
    nodeContext?: NodeContext,
    parentMap?: ParentMap,
    path: string = ''
  ): VNode {
    // ── 1. 校验 ──
    if (!schema || typeof schema !== 'object') {
      return this.createErrorVNode('Invalid schema')
    }
    if (!schema.type) {
      return this.createErrorVNode('Schema missing type property')
    }

    if (!this.preparedByPlugin.has(schema)) {
      this.preparedByPlugin.add(schema)
      for (const plugin of this.plugins) {
        plugin.prepare?.(schema as VueSchemaNode)
      }
    }

    const intercepted = this.regionInterceptor?.(schema, path, ctx)
    if (intercepted) return intercepted

    // ── 2. parentMap 注册 ──
    this.registerParentMap(schema, nodeContext, parentMap)
    emitPerformance('legacyRenderNode')

    // ── 3. 条件渲染（cond） ──
    const condValue = this.evaluateCond(schema, ctx)
    if (condValue === null) return null as any
    if (condValue instanceof Error) {
      return this.createErrorVNode(`Condition evaluation error: ${condValue.message}`, true)
    }

    // ── 4. show 求值 ──
    const showValue = this.evaluateShow(schema, ctx)

    // ── 5. 子树组件化 ──
    if (shouldComponentize(schema)) {
      return createVarioNodeVNode(schema, ctx, path, this, {
        modelPathStack, nodeContext, parentMap, key: path || undefined
      })
    }

    // ── 6. loop 处理 ──
    if (schema.loop) {
      return this.loopHandler.createLoopVNode(schema, ctx, modelPathStack, parentMap, path) || null as any
    }

    // ── 7. 组件解析 ──
    const component = this.componentResolver.resolveComponent(schema.type)
    if (!component) {
      return this.createErrorVNode(`Component "${schema.type}" not found`)
    }

    // ── 8. model 路径栈更新 ──
    const { currentModelPathStack, scopePath } = this.resolveModelStack(schema, modelPathStack, ctx)

    // ── 9. 构建 attrs + children ──
    let attrs = this.attrsBuilder.buildAttrs(
      schema, ctx, component, modelPathStack,
      (props, rctx) => this.childrenResolver.evalProps(props, rctx),
      scopePath ? currentModelPathStack : undefined,
      nodeContext, parentMap
    )
    const children = this.childrenResolver.resolveChildren(schema, ctx, currentModelPathStack, parentMap, path)

    // ── 10. show → display:none ──
    if (schema.show) {
      attrs = this.applyShowDirective(attrs, showValue, schema)
    }

    // ── 11. slots 规范化 + lifecycle → h() ──
    const vueSchema = schema as VueSchemaNode
    const finalChildren = this.normalizeChildren(children, component)
    let vnode = this.createComponentVNode(component, attrs || {}, finalChildren, vueSchema, ctx)

    // ── 12. 后处理装饰器 ──
    vnode = this.applyVNodeDecorators(vnode, schema, vueSchema, ctx)

    return vnode
  }

  renderNode(
    schema: SchemaNode,
    ctx: RuntimeContext,
    path = ''
  ): VNode {
    return this.createVNode(schema, ctx, [], undefined, this._stableParentMap, path)
  }

  /** 注册 parentMap（节点→父节点映射） */
  private registerParentMap(schema: SchemaNode, nodeContext?: NodeContext, parentMap?: ParentMap): void {
    if (parentMap == null) return
    emitPerformance('parentMapWrite')
    parentMap.set(schema, nodeContext?.parent ?? null)
  }

  /** 求值 cond 表达式。返回 truthy 值 / null（false）/ Error */
  private evaluateCond(schema: SchemaNode, ctx: RuntimeContext): unknown | null | Error {
    if (!schema.cond) return true
    try {
      const val = this.expressionEvaluator.evaluateExpr(schema.cond, ctx)
      return val ? val : null
    } catch (error) {
      if (error instanceof RangeError) throw error
      return error instanceof Error ? error : new Error(String(error))
    }
  }

  /** 求值 show 表达式 */
  private evaluateShow(schema: SchemaNode, ctx: RuntimeContext): unknown {
    if (!schema.show) return true
    try {
      return this.expressionEvaluator.evaluateExpr(schema.show, ctx)
    } catch (error) {
      if (error instanceof RangeError) throw error
      return true
    }
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
      try {
        const result = plugin.wrapComponent(component, attrs, children, vueSchema, ctx)
        if (result !== null) return result
      } catch (error) {
        this.sink?.emit({
          name: 'plugin-error',
          diagnostic: { code: plugin.name, message: 'plugin-error', path: '', phase: 'plugin' }
        })
        throw error
      }
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
      vnode = attachRef(vnode, vueSchema, this.refsRegistry, this.instance, {
        inLoop: '$item' in ctx || '$index' in ctx
      })
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
      try {
        const result = plugin.wrapComponent(component, attrs, children, vueSchema, ctx)
        if (result !== null) return result
      } catch (error) {
        this.sink?.emit({
          name: 'plugin-error',
          diagnostic: { code: plugin.name, message: 'plugin-error', path: '', phase: 'plugin' }
        })
        throw error
      }
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
  attachRef(vnode: VNode, vueSchema: VueSchemaNode, ctx?: RuntimeContext): VNode {
    return attachRef(vnode, vueSchema, this.refsRegistry, this.instance, {
      inLoop: !!(ctx && ('$item' in ctx || '$index' in ctx))
    })
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

  /**
   * 清除组件解析缓存
   */
  public clearComponentCache(): void {
    this.componentResolver.clearComponentCache()
  }

  /**
   * 使特定组件的缓存失效
   */
  public invalidateComponentCache(type: string): void {
    this.componentResolver.invalidateComponentCache(type)
  }
}
