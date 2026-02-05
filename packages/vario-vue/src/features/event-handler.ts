/**
 * 事件处理模块
 *
 * 负责处理 Schema 中的事件绑定；支持 nodeContext 时在事件执行前挂载 $self / $parent / $siblings / $children。
 */

import type { RuntimeContext, Action, EventModifiers, WritableAction } from '@variojs/types'
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
   * 从事件名中解析修饰符
   * 支持 Vue 风格：click.stop.prevent
   */
  private parseEventName(eventKey: string): { name: string; modifiers: string[] } {
    const parts = eventKey.split('.')
    const name = parts[0]
    const modifiers = parts.slice(1)
    return { name, modifiers }
  }

  /**
   * 从事件名中解析修饰符
   * 支持 Vue 风格：click.stop.prevent
   */
  private parseModifiers(eventKey: string): Record<string, boolean> {
    const modifiers: Record<string, boolean> = {}
    
    // 从事件名解析修饰符
    const { modifiers: nameModifiers } = this.parseEventName(eventKey)
    nameModifiers.forEach(m => { modifiers[m] = true })
    
    return modifiers
  }

  /**
   * 规范化事件处理器为 Action 数组
   * 支持多种格式：
   * 1. Action 对象
   * 2. Action[]
   * 3. 字符串（method 名）
   * 4. 字符串数组
   * 5. [call, method, params?, modifiers?] 数组简写（类似指令的四个固定位置）
   *    - params: 可以是数组（位置参数）或对象（包含 params 字段）
   */
  private normalizeEventHandler(handler: any, eventModifiers: Record<string, boolean> = {}): Action[] {
    // 1. 已经是数组
    if (Array.isArray(handler)) {
      const isCallShorthand =
        handler.length >= 2 &&
        handler[0] === 'call' &&
        typeof handler[1] === 'string'

      // 检查是否是数组简写格式 [call, method, params?, modifiers?]
      if (isCallShorthand) {
        // 数组简写：四个固定位置 [call, method, params?, modifiers?]
        const [, method, paramsOrOptions, modifiers] = handler
        
        // 创建类型安全的 call action
        const action: WritableAction<'call'> = { 
          type: 'call' as const, 
          method 
        }
        
        // 处理 params（第三个位置）
        // 支持两种形式：
        // 1. 数组形式：['{{name}}', 'static'] -> 直接作为 params
        // 2. 对象形式：{ params: { id: '{{id}}' } } -> 提取 params
        if (paramsOrOptions) {
          if (Array.isArray(paramsOrOptions) && paramsOrOptions.length > 0) {
            // 数组形式的参数，直接赋值给 params（位置参数）
            action.params = paramsOrOptions
          } else if (typeof paramsOrOptions === 'object' && !Array.isArray(paramsOrOptions)) {
            // 对象形式，可能包含 params
            if ('params' in paramsOrOptions && paramsOrOptions.params !== undefined) {
              action.params = paramsOrOptions.params
            }
          }
        }
        
        // 处理 modifiers（第四个位置）
        // 支持数组或对象格式
        if (modifiers) {
          const normalizedModifiers: Record<string, boolean> = {}
          
          if (Array.isArray(modifiers)) {
            // 数组形式: ['prevent', 'stop']
            modifiers.forEach(m => { normalizedModifiers[m] = true })
          } else if (typeof modifiers === 'object') {
            // 对象形式: { prevent: true, stop: true }
            Object.assign(normalizedModifiers, modifiers)
          }
          
          // 合并事件名修饰符和数组修饰符
          Object.assign(normalizedModifiers, eventModifiers)
          action.modifiers = normalizedModifiers
        } else if (Object.keys(eventModifiers).length > 0) {
          // 只有事件名修饰符
          action.modifiers = eventModifiers
        }
        
        return [action]
      }
      
      // 字符串数组
      if (handler.every(item => typeof item === 'string')) {
        return handler.map(method => ({
          type: 'call',
          method,
          ...(Object.keys(eventModifiers).length > 0 ? { modifiers: eventModifiers } : {})
        }))
      }
      
      // Action 数组
      return handler.map((action: Action) => {
        // 合并事件名修饰符
        if (Object.keys(eventModifiers).length > 0) {
          return {
            ...action,
            modifiers: { ...eventModifiers, ...((action as Action & { modifiers?: EventModifiers }).modifiers || {}) }
          }
        }
        return action
      })
    }
    
    // 2. 字符串（method 名简写）
    if (typeof handler === 'string') {
      return [{
        type: 'call',
        method: handler,
        ...(Object.keys(eventModifiers).length > 0 ? { modifiers: eventModifiers } : {})
      }]
    }
    
    // 3. 单个 Action 对象
    if (typeof handler === 'object' && handler != null) {
      // 合并事件名修饰符
      if (Object.keys(eventModifiers).length > 0) {
        return [{
          ...handler,
          modifiers: { ...eventModifiers, ...handler.modifiers }
        }]
      }
      return [handler]
    }
    
    // 未知格式，返回空数组
    console.warn('Unknown event handler format:', handler)
    return []
  }

  /**
   * 应用事件修饰符
   */
  private applyEventModifiers(event: Event, modifiers: Record<string, boolean>): boolean {
    // .prevent - 阻止默认行为
    if (modifiers.prevent) {
      event.preventDefault()
    }
    
    // .stop - 阻止冒泡
    if (modifiers.stop) {
      event.stopPropagation()
    }
    
    // .self - 只在事件源是自身时触发
    if (modifiers.self) {
      if (event.target !== event.currentTarget) {
        return false // 不执行处理器
      }
    }
    
    return true // 继续执行
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
      Object.entries(schema.events).forEach(([eventKey, actions]) => {
        const { name: eventName } = this.parseEventName(eventKey)
        const vueEventName = this.toEventName(eventName)
        const eventNameModifiers = this.parseModifiers(eventKey)
        
        // 规范化为 Action 数组（传入事件名修饰符用于合并）
        const normalizedActions = this.normalizeEventHandler(actions, eventNameModifiers)
        
        // 收集所有修饰符（事件名 + action 中的）
        const allModifiers: Record<string, boolean> = { ...eventNameModifiers }
        normalizedActions.forEach(action => {
          const actionWithModifiers = action as Action & { modifiers?: EventModifiers }
          if (actionWithModifiers.modifiers) {
            Object.assign(allModifiers, actionWithModifiers.modifiers)
          }
        })
        
        const hasOnce = allModifiers.once
        const hasCapture = allModifiers.capture
        const hasPassive = allModifiers.passive
        
        // 对于循环或作用域插槽：提前预处理 params（闭包捕获当前循环变量/作用域的值）
        const processedActions =
          isInLoop || isInScopedSlot
            ? this.preprocessActionsParams(normalizedActions, ctx)
            : normalizedActions
        
        const eventCtx = ctx
        const capturedNodeContext = nodeContext
        const capturedParentMap = parentMap

        let executed = false // 用于 .once 修饰符
        
        handlers[vueEventName] = (e: Event) => {
          // .once - 只执行一次
          if (hasOnce && executed) {
            return
          }
          
          // 应用修饰符（stop, prevent, self）- 使用合并后的所有修饰符
          const shouldContinue = this.applyEventModifiers(e, allModifiers)
          if (!shouldContinue) {
            return
          }
          
          eventCtx.$event = e
          if (capturedNodeContext != null && capturedParentMap != null) {
            applyNodeContextToCtx(
              eventCtx as Record<string, unknown>,
              schema,
              capturedNodeContext,
              capturedParentMap
            )
          }
          
          if (hasOnce) {
            executed = true
          }
          
          return this.executeInstructions(processedActions, eventCtx)
        }
        
        // .capture 和 .passive 需要通过 addEventListener 选项设置
        // Vue 会自动处理，但在 Vario 中我们需要添加特殊标记
        if (hasCapture || hasPassive) {
          // 给处理器添加元数据，供渲染器使用
          (handlers[vueEventName] as any).__modifiers = { capture: !!hasCapture, passive: !!hasPassive }
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
   * 用于循环或作用域插槽中的事件处理，确保使用创建时的变量值
   */
  private preprocessActionsParams(actions: Action[], ctx: RuntimeContext): Action[] {
    return actions.map(action => {
      if (action.type === 'call') {
        const callAction = action as WritableAction<'call'>
        if (callAction.params !== undefined) {
          const params = callAction.params
          
          // params 是字符串表达式（如 '{{ scope.row }}'）
          if (typeof params === 'string' && params.startsWith('{{') && params.endsWith('}}')) {
            try {
              const expr = params.slice(2, -2).trim()
              const evaluated = this.evaluateExpr(expr, ctx)
              return { ...callAction, params: evaluated }
            } catch (error) {
              console.warn(`Failed to evaluate params expression: ${params}`, error)
              return action
            }
          }
          
          // params 是对象，遍历其属性求值
          if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
            const evaluatedParams: Record<string, unknown> = {}
            
            for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
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
            
            return { ...callAction, params: evaluatedParams }
          }
        }
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
