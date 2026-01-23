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

import { h, type VNode, Fragment, ComponentInternalInstance, Transition, KeepAlive, type App } from 'vue'
import type { SchemaNode } from '@vario/schema'
import type { RuntimeContext } from '@vario/core'
import type { PathSegment } from '@vario/core'
import { attachRef, RefsRegistry } from './features/refs.js'
import { createTeleport, shouldTeleport } from './features/teleport.js'
import { ModelPathResolver } from './features/path-resolver.js'
import { ComponentResolver } from './features/component-resolver.js'
import { ExpressionEvaluator } from './features/expression-evaluator.js'
import { EventHandler } from './features/event-handler.js'
import { AttrsBuilder } from './features/attrs-builder.js'
import { LoopHandler } from './features/loop-handler.js'
import { ChildrenResolver } from './features/children-resolver.js'
import { LifecycleWrapper } from './features/lifecycle-wrapper.js'
import type { VueSchemaNode } from './types.js'

/**
 * Model 路径解析配置
 */
export interface ModelPathConfig {
  autoResolve: boolean
  separator: string
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
  getState?: () => any  // 用于创建响应式绑定的状态获取函数
  refsRegistry?: RefsRegistry  // Refs 注册表
  modelPath?: ModelPathConfig  // Model 路径解析配置
}

/**
 * Vue 渲染器
 * 将 Vario Schema 转换为 Vue VNode
 */
export class VueRenderer {
  public refsRegistry: RefsRegistry
  private getState?: () => any
  private modelPathConfig: ModelPathConfig
  
  // 功能模块
  private pathResolver: ModelPathResolver
  private componentResolver: ComponentResolver
  private expressionEvaluator: ExpressionEvaluator
  private eventHandler: EventHandler
  private attrsBuilder: AttrsBuilder
  private loopHandler: LoopHandler
  private childrenResolver: ChildrenResolver
  private lifecycleWrapper: LifecycleWrapper

  constructor(options: VueRendererOptions = {}) {
    this.getState = options.getState
    this.refsRegistry = options.refsRegistry || new RefsRegistry()
    this.modelPathConfig = options.modelPath || { autoResolve: true, separator: '.' }
    
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
    this.pathResolver = new ModelPathResolver(
      this.modelPathConfig,
      (expr, ctx) => this.expressionEvaluator.evaluateExpr(expr, ctx)
    )
    this.attrsBuilder = new AttrsBuilder(this.getState, this.pathResolver, this.eventHandler)
    this.lifecycleWrapper = new LifecycleWrapper()
    
    // LoopHandler 和 ChildrenResolver 需要 createVNode 方法，使用箭头函数绑定 this
    const createVNodeFn = (schema: SchemaNode, ctx: RuntimeContext, modelPathStack?: PathSegment[]) => 
      this.createVNode(schema, ctx, modelPathStack || [])
    
    this.loopHandler = new LoopHandler(
      this.pathResolver,
      createVNodeFn,
      (expr, ctx) => this.expressionEvaluator.evaluateExpr(expr, ctx)
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
    const vnode = this.createVNode(schema, ctx)
    // 如果返回 null，返回一个空的 Fragment 作为占位符
    // Vue 需要有效的 VNode，不能是 null
    if (vnode === null || vnode === undefined) {
      return h(Fragment, null, [])
    }
    return vnode
  }

  /**
   * 创建 VNode
   * @param schema Schema 节点
   * @param ctx 运行时上下文
   * @param modelPathStack 当前 model 路径栈（用于自动路径拼接）
   */
  private createVNode(
    schema: SchemaNode | VueSchemaNode,
    ctx: RuntimeContext,
    modelPathStack: PathSegment[] = []
  ): VNode {
    // 验证 schema 基本结构
    if (!schema || typeof schema !== 'object') {
      return h('div', { style: 'color: red; padding: 10px;' }, 'Invalid schema')
    }
    
    if (!schema.type) {
      return h('div', { style: 'color: red; padding: 10px;' }, 'Schema missing type property')
    }
    
    // 处理条件渲染（优化：提前返回，避免不必要的处理）
    if (schema.cond) {
      try {
        const condition = this.expressionEvaluator.evaluateExpr(schema.cond, ctx)
        if (!condition) {
          // 条件不满足，返回 null（Vue 会正确处理 null VNode）
          return null as any
        }
      } catch (error) {
        // 表达式求值错误，返回错误提示节点
        const errorMessage = error instanceof Error ? error.message : String(error)
        return h('div', { 
          style: 'color: red; padding: 10px; border: 1px solid red;' 
        }, `Condition evaluation error: ${errorMessage}`)
      }
    }

    // 处理列表渲染
    if (schema.loop) {
      const loopVNode = this.loopHandler.createLoopVNode(schema, ctx, modelPathStack)
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
    let currentModelPathStack = [...modelPathStack]
    if (schema.model && this.modelPathConfig.autoResolve) {
      currentModelPathStack = this.pathResolver.updateModelPathStack(
        schema.model as string,
        modelPathStack,
        ctx,
        schema
      )
    }
    
    // 构建属性（传入 component 和路径栈用于自动检测）
    // buildAttrs 中会解析 model 路径，这里传入当前路径栈
    let attrs = this.attrsBuilder.buildAttrs(
      schema,
      ctx,
      component,
      modelPathStack,
      (props, ctx) => this.childrenResolver.evalProps(props, ctx)
    )
    
    // 解析子节点（支持作用域插槽，传递路径栈）
    let children = this.childrenResolver.resolveChildren(schema, ctx, currentModelPathStack)
    
    // 处理可见性控制（v-show，优化：错误处理）
    if (schema.show) {
      try {
        const isVisible = this.expressionEvaluator.evaluateExpr(schema.show, ctx)
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
    
    return vnode
  }

  /**
   * 清除组件解析缓存
   * 用于组件注册变更后的缓存失效
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
