/**
 * 转发上下文原语：loop / scope 共用的"不挂父 ctx 原型"的 Proxy 转发结构。
 *
 * - 词法绑定放在 locals 上；state 通过 Proxy 转发到 parent。
 * - parents WeakMap 记录转发关系，供 session/execution 查找回落父 ctx。
 */

import type { RuntimeContext } from '@variojs/types'

const SYSTEM_COPY = ['_get', '_set', '$emit', '$methods', '$exprOptions'] as const

const parents = new WeakMap<object, RuntimeContext>()

export function createForwardingContext(
  parentCtx: RuntimeContext,
  locals: Record<string, unknown>
): RuntimeContext {
  for (const key of SYSTEM_COPY) {
    locals[key] = (parentCtx as Record<string, unknown>)[key]
  }

  const forwarded = new Proxy(locals, {
    get(target, prop) {
      if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(target, prop)) {
        return target[prop]
      }
      return Reflect.get(parentCtx, prop, parentCtx)
    },
    set(target, prop, value) {
      ;(target as Record<string | symbol, unknown>)[prop] = value
      return true
    },
    has(target, prop) {
      if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(target, prop)) return true
      return Reflect.has(parentCtx, prop)
    },
    getPrototypeOf() {
      return Object.prototype
    }
  })
  parents.set(forwarded, parentCtx)
  return forwarded as RuntimeContext
}

/**
 * 查询转发 ctx 的父 ctx（loop/scope 均支持）；非转发 ctx 返回 undefined。
 */
export function getParentContext(ctx: object | null | undefined): RuntimeContext | undefined {
  if (!ctx) return undefined
  return parents.get(ctx)
}
