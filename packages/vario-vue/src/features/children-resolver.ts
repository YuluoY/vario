/**
 * 子节点处理模块
 *
 * 负责解析 Schema 的子节点，包括作用域插槽和文本内容；支持 parentMap / nodeContext 供事件中 $parent / $siblings 使用。
 */

import { createScopeContext, type RuntimeContext, type PathSegment } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'
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
   * 支持插槽（template 节点）和作用域插槽；传入 parentMap / parentPath 供 ctx.$parent 使用
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
        const childPath = parentPath ? `${parentPath}.${i}` : String(i)
        return this.createVNode(child, ctx, modelPathStack, {
          parent: schema,
          siblings: children as SchemaNode[],
          selfIndex: i,
          path: childPath
        }, parentMap, childPath)
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
    _parentSchema?: SchemaNode,
    parentPath: string = ''
  ): Record<string, (scope?: any) => any> {
    const s: Record<string, (scope?: any) => any> = {}
    const r: any[] = []
    const createVNode = this.createVNode

    children.forEach((child: SchemaNode, idx: number) => {
      const childPath = parentPath ? `${parentPath}.${idx}` : String(idx)
      if (child.type === 'template' && (child as any).slot) {
        const t = child as any
        const k = t.slot
        const n = t.props?.scope
        // 每帧重建插槽函数：插槽 ctx 用 createScopeContext（只多一层局部绑定，
        // 不注入 $item/$index，外层循环项可穿透，FR-5）
        s[k] = (scope?: any) => {
          let slotCtx = ctx
          if (n && scope !== undefined) {
            slotCtx = createScopeContext(ctx, { [n]: scope })
          }
          if (typeof t.children === 'string') {
            return this.resolveTextContent(t.children, slotCtx)
          }
          if (Array.isArray(t.children)) {
            return (t.children as SchemaNode[])
              .map((c: SchemaNode, i: number) => {
                const cPath = childPath ? `${childPath}.${i}` : String(i)
                return createVNode(c, slotCtx, modelPathStack, {
                  parent: t,
                  siblings: t.children as SchemaNode[],
                  selfIndex: i,
                  path: cPath
                }, parentMap, cPath)
              })
              .filter((v: any) => v !== null && v !== undefined)
          }
          return null
        }
      } else {
        const vnode = createVNode(child, ctx, modelPathStack, {
          parent: _parentSchema,
          siblings: children,
          selfIndex: idx,
          path: childPath
        }, parentMap, childPath)
        if (vnode) r.push(vnode)
      }
    })

    if (r.length > 0) {
      const slots = Object.assign({}, s)
      if (!slots.default) {
        slots.default = () => r
      } else {
        const d = slots.default
        slots.default = (scope?: any) => {
          const v = d(scope)
          return Array.isArray(v) ? [...v, ...r] : r
        }
      }
      return slots
    }
    return s
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
        if (error instanceof RangeError) throw error
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
