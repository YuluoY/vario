/**
 * 作用域插槽上下文：只多一层局部绑定，不注入 $item/$index。
 *
 * 与 HEAD 的 Object.create(ctx) 语义对齐（插槽参数优先于 state 同名键），
 * 但不挂父 ctx 原型，通过 Proxy 转发 + isScopeContext 标记判定。
 */

import type { RuntimeContext } from '@variojs/types'
import { createForwardingContext } from './forwarding-context.js'

const scopeContexts = new WeakSet<object>()

export function createScopeContext(
  parentCtx: RuntimeContext,
  bindings: Record<string, unknown>
): RuntimeContext {
  const scopeCtx = createForwardingContext(parentCtx, { ...bindings })
  scopeContexts.add(scopeCtx)
  return scopeCtx
}

export function isScopeContext(ctx: unknown): boolean {
  return typeof ctx === 'object' && ctx !== null && scopeContexts.has(ctx)
}
