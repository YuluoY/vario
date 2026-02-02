/**
 * 事件处理模块
 *
 * 负责处理 Schema 中的事件绑定；支持 nodeContext 时在事件执行前挂载 $self / $parent / $siblings / $children。
 */

import type { RuntimeContext, Action } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'
import { execute } from '@variojs/core'
import { applyNodeContextToCtx } from './node-context.js'
import type { NodeContext } from './node-context.js'
import type { ParentMap } from './node-context.js'

/**
 * 事件处理器
 */
export class EventHandler {
  private eventHandlerCache = new WeakMap<SchemaNode, Record<string, (e: Event) => void>>()

  constructor(
    private evaluateExpr: (expr: string, ctx: RuntimeContext) => any
  ) {}

  /**
   * 将事件名转换为 Vue 事件处理器名
   * click -> onClick, change -> onChange
   */
  toEventName(event: string): string {
    return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`
  }

  /**
   * 获取事件处理器（使用缓存）
   * @param nodeContext 节点上下文（父、兄弟等），有则事件执行前挂到 ctx 上
   * @param parentMap 节点→父节点映射，用于 createNodeProxy 链式 .parent
   */
  getEventHandlers(
    schema: SchemaNode,
    ctx: RuntimeContext,
    nodeContext?: NodeContext,
    parentMap?: ParentMap
  ): Record<string, (e: Event) => void> {
    const isInLoop = '$item' in ctx || '$index' in ctx
    const isInScopedSlot = 'scope' in ctx
    const hasNodeContext = nodeContext != null && parentMap != null

    // 循环、作用域插槽、或提供了 nodeContext 时不使用缓存，保证每个位置拿到正确的上下文
    if (!isInLoop && !isInScopedSlot && !hasNodeContext) {
      const cached = this.eventHandlerCache.get(schema)
      if (cached) {
        return cached
      }
    }

    const handlers: Record<string, (e: Event) => void> = {}

    if (schema.events) {
      Object.entries(schema.events).forEach(([event, actions]) => {
        const eventName = this.toEventName(event)
        const processedActions =
          isInLoop || isInScopedSlot
            ? this.preprocessActionsParams(actions as Action[], ctx)
            : (actions as Action[])
        const eventCtx = ctx
        const capturedNodeContext = nodeContext
        const capturedParentMap = parentMap

        handlers[eventName] = (e: Event) => {
          eventCtx.$event = e
          if (capturedNodeContext != null && capturedParentMap != null) {
            applyNodeContextToCtx(
              eventCtx as Record<string, unknown>,
              schema,
              capturedNodeContext,
              capturedParentMap
            )
          }
          return this.executeInstructions(processedActions, eventCtx)
        }
      })
    }

    if (!isInLoop && !isInScopedSlot && !hasNodeContext) {
      this.eventHandlerCache.set(schema, handlers)
    }

    return handlers
  }
  
  /**
   * 预处理 actions 中的 params，将表达式立即求值
   * 用于循环中的事件处理，确保使用创建时的循环变量值
   */
  private preprocessActionsParams(actions: Action[], ctx: RuntimeContext): Action[] {
    return actions.map(action => {
      if (action.type === 'call' && action.params) {
        const params = action.params as Record<string, unknown>
        const evaluatedParams: Record<string, unknown> = {}
        
        for (const [key, value] of Object.entries(params)) {
          if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
            // 立即求值表达式
            try {
              const expr = value.slice(2, -2).trim()
              evaluatedParams[key] = this.evaluateExpr(expr, ctx)
            } catch (error) {
              console.warn(`Failed to evaluate param expression: ${value}`, error)
              evaluatedParams[key] = value
            }
          } else {
            evaluatedParams[key] = value
          }
        }
        
        return { ...action, params: evaluatedParams }
      }
      return action
    })
  }

  /**
   * 执行动作序列
   */
  private async executeInstructions(
    actions: Action[],
    ctx: RuntimeContext
  ): Promise<void> {
    try {
      await execute(actions, ctx)
    } catch (error) {
      throw error
    }
  }
}
