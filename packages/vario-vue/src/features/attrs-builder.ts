/**
 * 属性构建模块
 * 
 * 负责构建 Vue 组件的属性对象，包括 props、model 绑定、事件等
 */

import type { RuntimeContext } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'
import type { PathSegment } from '@variojs/core'
import { createModelBinding } from '../bindings.js'
import type { ModelPathResolver } from './path-resolver.js'
import type { EventHandler } from './event-handler.js'

/**
 * 属性构建器
 */
export class AttrsBuilder {
  private staticAttrsCache = new WeakMap<SchemaNode, Record<string, any>>()

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
   * 检查props是否完全静态（不包含表达式）
   */
  hasStaticProps(schema: SchemaNode): boolean {
    if (!schema.props) return true
    
    for (const value of Object.values(schema.props)) {
      if (typeof value === 'string' && (value.includes('{{') || value.includes('${'))) {
        return false
      }
      if (typeof value === 'object' && value !== null) {
        // 递归检查嵌套对象
        const nested = value as Record<string, unknown>
        for (const nestedValue of Object.values(nested)) {
          if (typeof nestedValue === 'string' && (nestedValue.includes('{{') || nestedValue.includes('${'))) {
            return false
          }
        }
      }
    }
    return true
  }

  /**
   * 合并动态属性（model绑定、事件）到静态属性
   */
  mergeDynamicAttrs(
    schema: SchemaNode,
    ctx: RuntimeContext,
    component: any,
    staticAttrs: Record<string, any>,
    modelPathStack: PathSegment[] = []
  ): Record<string, any> {
    const attrs = { ...staticAttrs }

    // 有 path 且非仅作用域（scope: true）时创建绑定；对象形式可带 default
    const modelPathStr = this.pathResolver.getModelPath(schema.model)
    const scopeOnly =
      typeof schema.model === 'object' && schema.model !== null && (schema.model as { scope?: boolean }).scope === true
    const shouldBindModel = !!modelPathStr && !scopeOnly
    if (shouldBindModel && modelPathStr) {
      const modelPath = this.pathResolver.resolveModelPath(
        modelPathStr,
        schema,
        ctx,
        modelPathStack
      )
      const schemaDefault = this.pathResolver.getModelDefault(schema.model)
      const schemaLazy = this.resolveModelLazy(schema.model)
      const binding = createModelBinding(
        schema.type,
        modelPath,
        ctx,
        component,
        this.getState,
        undefined,
        schemaDefault,
        schemaLazy
      )
      Object.assign(attrs, binding)
    }
    
    // 添加具名model绑定
    for (const key in schema) {
      if (key.startsWith('model:')) {
        const modelName = key.slice(6)
        const modelPath = this.pathResolver.resolveModelPath(
          (schema as any)[key],
          schema,
          ctx,
          modelPathStack
        )
        const binding = createModelBinding(
          schema.type, 
          modelPath, 
          ctx, 
          component, 
          this.getState, 
          modelName
        )
        Object.assign(attrs, binding)
      }
    }
    
    // 添加事件处理器
    if (schema.events) {
      const eventHandlers = this.eventHandler.getEventHandlers(schema, ctx)
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
   */
  buildAttrs(
    schema: SchemaNode,
    ctx: RuntimeContext,
    component: any,
    modelPathStack: PathSegment[] = [],
    evalProps: (props: Record<string, any>, ctx: RuntimeContext) => Record<string, any>
  ): Record<string, any> {
    // 检查静态属性缓存（如果props中没有表达式，可以缓存）
    const hasStaticProps = this.hasStaticProps(schema)
    if (hasStaticProps) {
      const cached = this.staticAttrsCache.get(schema)
      if (cached) {
        // 合并动态部分（model绑定、事件）
        return this.mergeDynamicAttrs(schema, ctx, component, cached, modelPathStack)
      }
    }

    // 批量构建属性数组，最后一次性合并
    const attrsParts: Record<string, any>[] = []
    
    // 1. 合并 props（支持表达式插值）
    if (schema.props) {
      attrsParts.push(evalProps(schema.props, ctx))
    }
    
    // 2. 处理双向绑定（支持多 model）。有 path 且非仅作用域时创建绑定，支持 model.default
    const modelPathStr = this.pathResolver.getModelPath(schema.model)
    const scopeOnly =
      typeof schema.model === 'object' && schema.model !== null && (schema.model as { scope?: boolean }).scope === true
    const shouldBindModel = !!modelPathStr && !scopeOnly
    if (shouldBindModel && modelPathStr) {
      const modelPath = this.pathResolver.resolveModelPath(
        modelPathStr,
        schema,
        ctx,
        modelPathStack
      )
      const schemaDefault = this.pathResolver.getModelDefault(schema.model)
      const schemaLazy = this.resolveModelLazy(schema.model)
      const binding = createModelBinding(
        schema.type,
        modelPath,
        ctx,
        component,
        this.getState,
        undefined,
        schemaDefault,
        schemaLazy
      )
      attrsParts.push(binding)
    }

    // 处理具名 model（model:xxx）
    for (const key in schema) {
      if (key.startsWith('model:')) {
        const modelName = key.slice(6) // 移除 'model:' 前缀
        const modelPath = this.pathResolver.resolveModelPath(
          (schema as any)[key],
          schema,
          ctx,
          modelPathStack
        )
        const binding = createModelBinding(
          schema.type, 
          modelPath, 
          ctx, 
          component, 
          this.getState, 
          modelName
        )
        attrsParts.push(binding)
      }
    }
    
    // 3. 处理事件（使用缓存）
    if (schema.events) {
      const eventHandlers = this.eventHandler.getEventHandlers(schema, ctx)
      attrsParts.push(eventHandlers)
    }
    
    // 批量合并所有属性
    const attrs = Object.assign({}, ...attrsParts)
    
    // 4. 统一处理 style 格式（确保始终是对象）
    if (attrs.style) {
      if (typeof attrs.style === 'string') {
        const styleObj: Record<string, string> = {}
        attrs.style.split(';').forEach((rule: string) => {
          const [key, value] = rule.split(':').map((s: string) => s.trim())
          if (key && value) {
            const camelKey = key.replace(/-([a-z])/g, (_: string, letter: string) => letter.toUpperCase())
            styleObj[camelKey] = value
          }
        })
        attrs.style = styleObj
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
