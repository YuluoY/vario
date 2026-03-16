/**
 * 属性构建模块
 * 
 * 负责构建 Vue 组件的属性对象，包括 props、model 绑定、事件等
 */

import type { RuntimeContext, PathSegment } from '@variojs/types'
import type { SchemaNode } from '@variojs/schema'
import { createModelBinding } from '../bindings.js'
import type { ModelPathResolver } from './path-resolver.js'
import type { EventHandler } from './event-handler.js'
import type { NodeContext } from './node-context.js'
import type { ParentMap } from './node-context.js'
import { parseStyleString } from './style-utils.js'

/**
 * 属性构建器
 */
export class AttrsBuilder {
  private staticAttrsCache = new WeakMap<SchemaNode, Record<string, any>>()
  private staticPropsCache = new WeakMap<SchemaNode, boolean>()

  constructor(
    private getState: (() => any) | undefined,
    private pathResolver: ModelPathResolver,
    private eventHandler: EventHandler,
    /** 整棵 schema 的 model 默认惰性，节点未显式设置 lazy 时使用 */
    private modelLazy?: boolean
  ) {}

  /**
   * 解析当前节点的 model lazy：节点显式设置 lazy 时用节点值，否则用整棵 schema 的 modelLazy 默认值
   */
  private resolveModelLazy(model: unknown): boolean {
    const nodeLazy =
      model != null && typeof model === 'object' && typeof (model as { lazy?: boolean }).lazy === 'boolean'
        ? (model as { lazy: boolean }).lazy
        : undefined
    return nodeLazy ?? this.modelLazy ?? false
  }

  /**
   * 创建 model 绑定（主模型 / 具名模型共用）
   *
   * @param model      原始 schema model 值
   * @param schema     当前 schema 节点（供 resolveModelPath 使用）
   * @param ctx        运行时上下文
   * @param component  已解析的组件
   * @param modelPathStack  路径栈（扁平路径拼接用）
   * @param modelName  具名 model 名称，undefined 表示默认 model
   */
  private resolveAndCreateBinding(
    model: unknown,
    schema: SchemaNode,
    ctx: RuntimeContext,
    component: any,
    modelPathStack: PathSegment[],
    modelName?: string
  ): Record<string, any> | null {
    const pathStr = this.pathResolver.getModelPath(model)
    if (!pathStr) return null

    // 默认 model 需要额外的 scope 检查
    if (modelName === undefined) {
      const scopeOnly =
        typeof model === 'object' && model !== null && (model as { scope?: boolean }).scope === true
      if (scopeOnly) return null
    }

    const modelPath = this.pathResolver.resolveModelPath(pathStr, schema, ctx, modelPathStack)
    const schemaDefault = this.pathResolver.getModelDefault(model)
    const schemaLazy = this.resolveModelLazy(model)
    const schemaModifiers = this.pathResolver.getModelModifiers(model)
    return createModelBinding(
      schema.type,
      modelPath,
      ctx,
      component,
      this.getState,
      modelName,
      schemaDefault,
      schemaLazy,
      schemaModifiers
    )
  }

  /**
   * 检查props是否完全静态（不包含表达式），结果缓存到 WeakMap
   */
  hasStaticProps(schema: SchemaNode): boolean {
    const cached = this.staticPropsCache.get(schema)
    if (cached !== undefined) return cached
    
    let result = true
    if (schema.props) {
      outer: for (const value of Object.values(schema.props)) {
        if (typeof value === 'string' && (value.includes('{{') || value.includes('${'))) {
          result = false
          break
        }
        if (typeof value === 'object' && value !== null) {
          const nested = value as Record<string, unknown>
          for (const nestedValue of Object.values(nested)) {
            if (typeof nestedValue === 'string' && (nestedValue.includes('{{') || nestedValue.includes('${'))) {
              result = false
              break outer
            }
          }
        }
      }
    }
    this.staticPropsCache.set(schema, result)
    return result
  }

  /**
   * 合并动态属性（model绑定、事件）到静态属性
   */
  mergeDynamicAttrs(
    schema: SchemaNode,
    ctx: RuntimeContext,
    component: any,
    staticAttrs: Record<string, any>,
    modelPathStack: PathSegment[] = [],
    nodeContext?: NodeContext,
    parentMap?: ParentMap
  ): Record<string, any> {
    const attrs = { ...staticAttrs }

    // 默认 model 绑定
    const defaultBinding = this.resolveAndCreateBinding(schema.model, schema, ctx, component, modelPathStack)
    if (defaultBinding) Object.assign(attrs, defaultBinding)
    
    // 具名 model 绑定（model:xxx）
    for (const key in schema) {
      if (key.startsWith('model:')) {
        const binding = this.resolveAndCreateBinding(
          (schema as any)[key], schema, ctx, component, modelPathStack, key.slice(6)
        )
        if (binding) Object.assign(attrs, binding)
      }
    }
    
    // 添加事件处理器
    if (schema.events) {
      const eventHandlers = this.eventHandler.getEventHandlers(schema, ctx, nodeContext, parentMap)
      Object.assign(attrs, eventHandlers)
    }

    return attrs
  }

  /**
   * 构建属性对象
   * 
   * 优化策略：
   * - 批量设置属性（减少Object.assign调用）
   * - 静态属性缓存（提升性能）
   * - 事件处理器缓存（避免重复创建）
   * 
   * @param scopePathStack 当前节点的 scope 路径栈（用于具名 model 路径解析）
   * @param nodeContext 节点上下文（父、兄弟等），供事件中 ctx.$parent / $siblings 使用
   * @param parentMap 节点→父节点映射，供 createNodeProxy 链式 .parent
   */
  buildAttrs(
    schema: SchemaNode,
    ctx: RuntimeContext,
    component: any,
    modelPathStack: PathSegment[] = [],
    evalProps: (props: Record<string, any>, ctx: RuntimeContext) => Record<string, any>,
    scopePathStack?: PathSegment[],
    nodeContext?: NodeContext,
    parentMap?: ParentMap
  ): Record<string, any> {
    const hasStaticProps = this.hasStaticProps(schema)
    if (hasStaticProps) {
      const cached = this.staticAttrsCache.get(schema)
      if (cached) {
        return this.mergeDynamicAttrs(
          schema,
          ctx,
          component,
          cached,
          modelPathStack,
          nodeContext,
          parentMap
        )
      }
    }

    // 批量构建属性数组，最后一次性合并
    const attrsParts: Record<string, any>[] = []
    
    // 1. 合并 props（支持表达式插值）
    if (schema.props) {
      attrsParts.push(evalProps(schema.props, ctx))
    }
    
    // 2. 处理双向绑定（默认 model）
    const defaultBinding = this.resolveAndCreateBinding(schema.model, schema, ctx, component, modelPathStack)
    if (defaultBinding) attrsParts.push(defaultBinding)

    // 处理具名 model（model:xxx，支持 path 字符串或 { path, default?, lazy? }）
    // 具名 model 使用 scopePathStack（如果当前节点是 scope）或 modelPathStack 来解析路径
    const namedModelPathStack = scopePathStack ?? modelPathStack
    for (const key in schema) {
      if (key.startsWith('model:')) {
        const binding = this.resolveAndCreateBinding(
          (schema as any)[key], schema, ctx, component, namedModelPathStack, key.slice(6)
        )
        if (binding) attrsParts.push(binding)
      }
    }
    
    // 3. 处理事件（使用缓存）
    if (schema.events) {
      const eventHandlers = this.eventHandler.getEventHandlers(schema, ctx, nodeContext, parentMap)
      attrsParts.push(eventHandlers)
    }
    
    // 批量合并所有属性
    const attrs = Object.assign({}, ...attrsParts)
    
    // 4. 统一处理 style 格式（确保始终是对象）
    if (attrs.style) {
      if (typeof attrs.style === 'string') {
        attrs.style = parseStyleString(attrs.style)
      } else if (Array.isArray(attrs.style)) {
        attrs.style = {}
      }
    }
    
    // 缓存静态属性
    if (hasStaticProps) {
      this.staticAttrsCache.set(schema, { ...attrs })
    }
    
    return attrs
  }
}
