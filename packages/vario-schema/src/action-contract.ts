/**
 * 内建 Action payload 校验表。未知 type / 缺参 / 错类型拒绝。
 */
import type { Action } from '@variojs/types'

const BUILTIN = new Set([
  'set', 'emit', 'navigate', 'log', 'if', 'loop', 'call', 'batch',
  'push', 'pop', 'shift', 'unshift', 'splice',
])

export type ActionValidationIssue = {
  code: string
  message: string
}

export function validateActionPayload(action: Action): ActionValidationIssue | null {
  const type = action.type
  if (typeof type !== 'string' || type.length === 0) {
    return { code: 'INVALID_ACTION', message: 'Action must have a type' }
  }
  if (!BUILTIN.has(type)) {
    return { code: 'UNKNOWN_ACTION_TYPE', message: `Unknown action type "${type}"` }
  }

  const rec = action as Record<string, unknown>
  switch (type) {
    case 'set':
      if (typeof rec.path !== 'string' || rec.path.length === 0) {
        return { code: 'ACTION_MISSING_PARAM', message: 'set requires path' }
      }
      if (!('value' in rec)) {
        return { code: 'ACTION_MISSING_PARAM', message: 'set requires value' }
      }
      return null
    case 'emit':
      if (typeof rec.event !== 'string' || rec.event.length === 0) {
        return { code: 'ACTION_MISSING_PARAM', message: 'emit requires event' }
      }
      return null
    case 'navigate':
      if (typeof rec.to !== 'string' || rec.to.length === 0) {
        return { code: 'ACTION_MISSING_PARAM', message: 'navigate requires to' }
      }
      return null
    case 'log':
      if (typeof rec.message !== 'string') {
        return { code: 'ACTION_MISSING_PARAM', message: 'log requires message' }
      }
      return null
    case 'if':
      if (typeof rec.cond !== 'string') {
        return { code: 'ACTION_MISSING_PARAM', message: 'if requires cond' }
      }
      return null
    case 'loop':
      if (typeof rec.var !== 'string' || typeof rec.in !== 'string' || !Array.isArray(rec.body)) {
        return { code: 'ACTION_MISSING_PARAM', message: 'loop requires var, in, body' }
      }
      return null
    case 'call':
      if (typeof rec.method !== 'string' || rec.method.length === 0) {
        return { code: 'ACTION_MISSING_PARAM', message: 'call requires method' }
      }
      return null
    case 'batch':
      if (!Array.isArray(rec.actions)) {
        return { code: 'ACTION_MISSING_PARAM', message: 'batch requires actions array' }
      }
      return null
    case 'push':
    case 'unshift':
      if (typeof rec.path !== 'string') {
        return { code: 'ACTION_MISSING_PARAM', message: `${type} requires path` }
      }
      if (!('value' in rec) && !('items' in rec)) {
        return { code: 'ACTION_MISSING_PARAM', message: `${type} requires value or items` }
      }
      return null
    case 'pop':
    case 'shift':
      if (typeof rec.path !== 'string') {
        return { code: 'ACTION_MISSING_PARAM', message: `${type} requires path` }
      }
      return null
    case 'splice':
      if (typeof rec.path !== 'string' || rec.start === undefined) {
        return { code: 'ACTION_MISSING_PARAM', message: 'splice requires path and start' }
      }
      return null
    default:
      return { code: 'UNKNOWN_ACTION_TYPE', message: `Unknown action type "${type}"` }
  }
}
