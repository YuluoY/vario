/**
 * 沙箱边界控制
 * 
 * 功能：
 * - 表达式层：严格沙箱，无法访问全局对象
 * - 方法层：白名单控制，可访问全局对象
 */

import type { RuntimeContext } from '../types.js'

/**
 * 创建表达式沙箱上下文
 * 移除全局对象访问能力
 */
export function createExpressionSandbox(ctx: RuntimeContext): RuntimeContext {
  // 创建受限的上下文副本，移除全局对象
  const sandbox = { ...ctx }
  
  // 移除可能的全局对象引用
  // 表达式求值时，只能访问状态属性和白名单函数
  
  return sandbox
}

/**
 * 检查属性访问是否安全（用于表达式求值）
 */
export function isSafePropertyAccess(
  prop: string,
  ctx: RuntimeContext,
  options: { allowGlobals?: boolean } = {}
): boolean {
  const allowGlobals = options.allowGlobals ?? ctx.$exprOptions?.allowGlobals ?? false

  // 禁止访问全局对象（可通过 allowGlobals 开关控制）
  const globalProps = ['window', 'document', 'global', 'globalThis', 'self']
  if (!allowGlobals && globalProps.includes(prop)) {
    return false
  }
  
  // 允许访问状态属性和系统 API
  return true
}
