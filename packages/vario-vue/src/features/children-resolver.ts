/**
 * 子节点处理模块
 *
 * 负责解析 Schema 的子节点，包括作用域插槽和文本内容；支持 parentMap / nodeContext 供事件中 $parent / $siblings 使用。
 */

import type { RuntimeContext } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'
import type { PathSegment } from '@variojs/core'
import type { ExpressionEvaluator } from './expression-evaluator.js'
import type { ParentMap } from './node-context.js'

export type CreateVNodeFn = (
  schema: SchemaNode,
  ctx: RuntimeContext,
  modelPathStack?: PathSegment[],
  nodeContext?: { parent?: SchemaNode; siblings?: SchemaNode[]; selfIndex?: number; path?: string },
  parentMap?: ParentMap,
  path?: string
) => any

/**
 * 子节点解析器
 */
export class ChildrenResolver {
  constructor(
    private createVNode: CreateVNodeFn,
    private expressionEvaluator: ExpressionEvaluator
  ) {}

  /**
   * 解析子节点
   * 支持插槽（template 节点）和作用域插槽；传入 parentMap / parentPath 供 ctx.$parent 与 path-memo 使用
   */
  resolveChildren(
    schema: SchemaNode,
    ctx: RuntimeContext,
    modelPathStack: PathSegment[] = [],
    parentMap?: ParentMap,
    parentPath: string = ''
  ): any {
    const children = schema.children
    if (!children) {
      return null
    }
    if (typeof children === 'string') {
      return this.resolveTextContent(children, ctx)
    }
    const hasSlots = children.some(
      (child: SchemaNode) => child.type === 'template' && (child as any).slot
    )
    if (hasSlots) {
      return this.resolveSlots(
        children as SchemaNode[],
        ctx,
        modelPathStack,
        parentMap,
        schema,
        parentPath
      )
    }
    const vnodes = (children as SchemaNode[])
      .map((child: SchemaNode, i: number) => {
        try {
          const childPath = parentPath ? `${parentPath}.${i}` : String(i)
          return this.createVNode(child, ctx, modelPathStack, {
            parent: schema,
            siblings: children as SchemaNode[],
            selfIndex: i,
            path: childPath
          }, parentMap, childPath)
        } catch (error) {
          return null
        }
      })
      .filter((vnode: any) => vnode !== null && vnode !== undefined)
    return vnodes.length > 0 ? vnodes : null
  }

  /**
   * 解析插槽（包括作用域插槽和普通插槽）
   * @param parentSchema 拥有 children 的父节点，用于注册 parentMap 及 nodeContext.parent
   */
  private resolveSlots(
    children: SchemaNode[],
    ctx: RuntimeContext,
    modelPathStack: PathSegment[] = [],
    parentMap?: ParentMap,
    parentSchema?: SchemaNode,
    parentPath: string = ''
  ): Record<string, (scope?: any) => any> {
    const slots: Record<string, (scope?: any) => any> = {}
    const regularChildren: any[] = []
    const createVNode = this.createVNode

    children.forEach((child: SchemaNode, idx: number) => {
      const childPath = parentPath ? `${parentPath}.${idx}` : String(idx)
      if (child.type === 'template' && (child as any).slot) {
        const template = child as any
        const slotName = template.slot
        const scopeVarName = template.props?.scope
        const isScoped = !!scopeVarName

        slots[slotName] = (scope?: any) => {
          let slotCtx = ctx
          if (isScoped && scope !== undefined) {
            slotCtx = Object.create(ctx)
            slotCtx[scopeVarName] = scope
          }
          if (typeof template.children === 'string') {
            return this.resolveTextContent(template.children, slotCtx)
          }
          if (Array.isArray(template.children)) {
            return (template.children as SchemaNode[])
              .map((c: SchemaNode, i: number) => {
                try {
                  const cPath = childPath ? `${childPath}.${i}` : String(i)
                  return createVNode(c, slotCtx, modelPathStack, {
                    parent: template,
                    siblings: template.children as SchemaNode[],
                    selfIndex: i,
                    path: cPath
                  }, parentMap, cPath)
                } catch (error) {
                  return null
                }
              })
              .filter((v: any) => v !== null && v !== undefined)
          }
          return null
        }
      } else {
        try {
          const vnode = createVNode(child, ctx, modelPathStack, {
            parent: parentSchema,
            siblings: children,
            selfIndex: idx,
            path: childPath
          }, parentMap, childPath)
          if (vnode) {
            regularChildren.push(vnode)
          }
        } catch (error) {
          // ignore
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
