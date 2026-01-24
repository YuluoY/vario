/**
 * 事件处理模块
 * 
 * 负责处理 Schema 中的事件绑定
 */

import type { RuntimeContext, Action } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'
import { execute } from '@variojs/core'

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
   */
  getEventHandlers(
    schema: SchemaNode,
    ctx: RuntimeContext
  ): Record<string, (e: Event) => void> {
    // 检查是否在循环上下文中（有 $item 或 $index）
    // 或者作用域插槽上下文中（有 scope 变量）
    const isInLoop = '$item' in ctx || '$index' in ctx
    const isInScopedSlot = 'scope' in ctx
    
    // 循环上下文或作用域插槽中不使用缓存，因为每个项需要不同的上下文
    if (!isInLoop && !isInScopedSlot) {
      const cached = this.eventHandlerCache.get(schema)
      if (cached) {
        return cached
      }
    }

    const handlers: Record<string, (e: Event) => void> = {}
    
    if (schema.events) {
      Object.entries(schema.events).forEach(([event, actions]) => {
        const eventName = this.toEventName(event)
        
        // 在循环或作用域插槽中，预处理 actions 中的 params，将表达式立即求值
        // 这样事件触发时使用的是创建时的值，而不是触发时的值
        const processedActions = (isInLoop || isInScopedSlot)
          ? this.preprocessActionsParams(actions as Action[], ctx)
          : actions as Action[]
        
        // 保存当前上下文引用，确保事件触发时使用正确的上下文
        const eventCtx = ctx
        
        handlers[eventName] = (e: Event) => {
          eventCtx.$event = e
          this.executeInstructions(processedActions, eventCtx)
        }
      })
    }

    // 仅在非循环且非作用域插槽上下文中缓存
    if (!isInLoop && !isInScopedSlot) {
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
