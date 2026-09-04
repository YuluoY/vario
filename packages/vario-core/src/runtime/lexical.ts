/**
 * 词法绑定查找：loop/slot/event 局部变量优先于 StateStore path。
 * 在 ScopeFrame 落地前，用 own-property / prototype 链模拟 lexical scope。
 */

import type { RuntimeContext } from '@variojs/types'
import { isForbiddenSegment } from './path-policy.js'

export function hasLexicalBinding(ctx: object, name: string): boolean {
  let current: object | null = ctx
  while (current && current !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(current, name)) {
      return true
    }
    current = Object.getPrototypeOf(current)
  }
  return false
}

export function getLexicalValue(ctx: object, name: string): unknown {
  let current: object | null = ctx
  while (current && current !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(current, name)) {
      return (current as Record<string, unknown>)[name]
    }
    current = Object.getPrototypeOf(current)
  }
  return undefined
}

export function readPathWithLexical(ctx: RuntimeContext, path: string): unknown {
  if (!path) return undefined
  const dot = path.indexOf('.')
  const first = dot === -1 ? path : path.slice(0, dot)
  if (!hasLexicalBinding(ctx, first)) {
    return ctx._get(path)
  }
  let value: unknown = getLexicalValue(ctx, first)
  if (dot === -1) return value
  const rest = path.slice(dot + 1).split('.')
  for (const segment of rest) {
    if (value == null || typeof value !== 'object') return undefined
    const key = /^\d+$/.test(segment) ? Number(segment) : segment
    if (typeof key === 'number' && Array.isArray(value)) {
      value = value[key]
    } else if (isForbiddenSegment(segment) || !(segment in value)) {
      return undefined
    } else {
      value = Reflect.get(value, segment)
    }
  }
  return value
}
