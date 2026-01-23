/**
 * 子节点处理模块
 * 
 * 负责解析 Schema 的子节点，包括作用域插槽和文本内容
 */

import type { RuntimeContext } from '@vario/core'
import type { SchemaNode } from '@vario/schema'
import type { PathSegment } from '@vario/core'
import type { ExpressionEvaluator } from './expression-evaluator.js'

/**
 * 子节点解析器
 */
export class ChildrenResolver {
  constructor(
    private createVNode: (
      schema: SchemaNode,
      ctx: RuntimeContext,
      modelPathStack?: PathSegment[]
    ) => any,
    private expressionEvaluator: ExpressionEvaluator
  ) {}

  /**
   * 解析子节点
   * 支持插槽（template 节点）和作用域插槽
   */
  resolveChildren(
    schema: SchemaNode,
    ctx: RuntimeContext,
    modelPathStack: PathSegment[] = []
  ): any {
    const children = schema.children
    if (!children) {
      return null
    }
    
    // 字符串子节点（支持表达式插值）
    if (typeof children === 'string') {
      return this.resolveTextContent(children, ctx)
    }
    
    // 检查是否有插槽（template 节点带 slot 属性）
    const hasSlots = children.some((child: SchemaNode) => 
      child.type === 'template' && (child as any).slot
    )
    
    if (hasSlots) {
      // 处理插槽（包括作用域插槽和普通插槽）
      return this.resolveSlots(children as SchemaNode[], ctx, modelPathStack)
    }
    
    // 数组子节点 - 过滤掉 null/undefined，确保返回有效的 VNode 数组
    const vnodes = children
      .map((child: SchemaNode) => {
        try {
          return this.createVNode(child, ctx, modelPathStack)
        } catch (error) {
          return null
        }
      })
      .filter((vnode: any) => vnode !== null && vnode !== undefined)
    
    // 如果所有子节点都无效，返回 null
    return vnodes.length > 0 ? vnodes : null
  }

  /**
   * 解析插槽（包括作用域插槽和普通插槽）
   * 将 template 节点转换为 Vue 3 的插槽函数
   */
  private resolveSlots(
    children: SchemaNode[],
    ctx: RuntimeContext,
    modelPathStack: PathSegment[] = []
  ): Record<string, (scope?: any) => any> {
    const slots: Record<string, (scope?: any) => any> = {}
    const regularChildren: any[] = []
    
    children.forEach((child: SchemaNode) => {
      if (child.type === 'template' && (child as any).slot) {
        const template = child as any
        const slotName = template.slot
        const scopeVarName = template.props?.scope
        const isScoped = !!scopeVarName
        
        // 创建插槽函数
        slots[slotName] = (scope?: any) => {
          // 创建上下文：作用域插槽需要添加 scope 变量
          let slotCtx = ctx
          if (isScoped && scope !== undefined) {
            slotCtx = Object.create(ctx)
            slotCtx[scopeVarName] = scope
          }
          
          // 解析子节点
          if (typeof template.children === 'string') {
            return this.resolveTextContent(template.children, slotCtx)
          } else if (Array.isArray(template.children)) {
            return template.children
              .map((c: SchemaNode) => {
                try {
                  return this.createVNode(c, slotCtx, modelPathStack)
                } catch (error) {
                  return null
                }
              })
              .filter((v: any) => v !== null && v !== undefined)
          }
          return null
        }
      } else {
        // 非 template 节点，收集到 regularChildren
        try {
          const vnode = this.createVNode(child, ctx, modelPathStack)
          if (vnode) {
            regularChildren.push(vnode)
          }
        } catch (error) {
          // 忽略错误
        }
      }
    })
    
    // 如果有普通子节点，添加到 default 插槽
    if (regularChildren.length > 0) {
      if (!slots.default) {
        slots.default = () => regularChildren
      } else {
        const existingDefault = slots.default
        slots.default = (scope?: any) => {
          const scoped = existingDefault(scope)
          return Array.isArray(scoped) ? [...scoped, ...regularChildren] : regularChildren
        }
      }
    }
    
    return slots
  }

  /**
   * 解析文本内容（支持表达式插值）
   */
  resolveTextContent(text: string, ctx: RuntimeContext): string {
    // 匹配 {{ expression }} 模式
    const exprPattern = /\{\{\s*([^}]+)\s*\}\}/g
    return text.replace(exprPattern, (match, expr) => {
      try {
        const trimmedExpr = expr.trim()
        const value = this.expressionEvaluator.evaluateExpr(trimmedExpr, ctx)
        
        return value != null ? String(value) : ''
      } catch (error) {
        console.warn('[Expression Error]', expr, error)
        return match
      }
    })
  }

  /**
   * 求值 props（支持表达式插值）
   */
  evalProps(
    props: Record<string, any>,
    ctx: RuntimeContext
  ): Record<string, any> {
    const result: Record<string, any> = {}
    
    Object.entries(props).forEach(([key, value]) => {
      if (typeof value === 'string') {
        // 检查是否为表达式插值
        if (value.startsWith('{{') && value.endsWith('}}')) {
          const expr = value.slice(2, -2).trim()
          result[key] = this.expressionEvaluator.evaluateExpr(expr, ctx)
        } else {
          // 普通字符串，检查是否包含表达式插值
          result[key] = this.resolveTextContent(value, ctx)
        }
      } else if (typeof value === 'object' && value !== null) {
        // 嵌套对象（递归处理）
        if (Array.isArray(value)) {
          result[key] = value.map((item) => 
            typeof item === 'string' 
              ? this.resolveTextContent(item, ctx)
              : this.evalProps(item as Record<string, any>, ctx)
          )
        } else {
          result[key] = this.evalProps(value as Record<string, any>, ctx)
        }
      } else {
        // 静态值
        result[key] = value
      }
    })
    
    return result
  }
}
