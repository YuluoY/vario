/**
 * 将 EventHandler 五种公开形式规范化为 Action[]。
 */
import type { Action, EventHandler, EventHandlerArray } from '@variojs/types'

export function isCallShorthand(handler: unknown): handler is EventHandlerArray {
  return Array.isArray(handler) &&
    handler.length >= 2 &&
    handler[0] === 'call' &&
    typeof handler[1] === 'string'
}

export function normalizeEventHandler(handler: EventHandler): Action[] {
  if (handler == null) return []

  if (typeof handler === 'string') {
    return [{ type: 'call', method: handler }]
  }

  if (isCallShorthand(handler)) {
    const [, method, paramsOrOptions, modifiers] = handler
    const action: Action & { type: 'call'; method: string; params?: unknown; modifiers?: unknown } = {
      type: 'call',
      method,
    }
    if (Array.isArray(paramsOrOptions) && paramsOrOptions.length > 0) {
      action.params = paramsOrOptions
    } else if (paramsOrOptions && typeof paramsOrOptions === 'object' && 'params' in (paramsOrOptions as object)) {
      action.params = (paramsOrOptions as { params?: unknown }).params
    }
    if (modifiers !== undefined) {
      action.modifiers = modifiers
    }
    return [action]
  }

  if (Array.isArray(handler)) {
    if (handler.length === 0) return []
    if (handler.every(item => typeof item === 'string')) {
      return (handler as readonly string[]).map(method => ({ type: 'call' as const, method }))
    }
    return handler.filter(Boolean) as Action[]
  }

  if (typeof handler === 'object' && typeof (handler as Action).type === 'string') {
    return [handler as Action]
  }

  return []
}
