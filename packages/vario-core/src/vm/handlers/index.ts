/**
 * 内置动作处理器
 *
 * 内建 action 走独立 registry，不再写入公共 ctx.$methods。
 */

import type { RuntimeContext, MethodHandler } from '@variojs/types'
import { handleSet } from './set.js'
import { handleEmit } from './emit.js'
import { handleIf } from './if.js'
import { handleLoop } from './loop.js'
import { handleCall } from './call.js'
import { handleBatch } from './batch.js'
import { handleNavigate } from './navigate.js'
import { handleLog } from './log.js'
import { handlePush } from './array/push.js'
import { handlePop } from './array/pop.js'
import { handleShift } from './array/shift.js'
import { handleUnshift } from './array/unshift.js'
import { handleSplice } from './array/splice.js'

/**
 * 内置动作处理器映射
 *
 * 使用无原型对象并 own-lookup，保证 constructor/toString/__proto__
 * 等原型链成员永远不会被当作 handler 解析（VM-6）。
 */
const BUILTIN_METHODS: Record<string, MethodHandler> = Object.assign(Object.create(null), {
  // 原子动作
  'set': handleSet as MethodHandler,
  'emit': handleEmit as MethodHandler,
  'navigate': handleNavigate as MethodHandler,
  'log': handleLog as MethodHandler,

  // 控制流动作
  'if': handleIf as MethodHandler,
  'loop': handleLoop as MethodHandler,

  // 复合动作
  'call': handleCall as MethodHandler,
  'batch': handleBatch as MethodHandler,

  // 数组操作动作
  'push': handlePush as MethodHandler,
  'pop': handlePop as MethodHandler,
  'shift': handleShift as MethodHandler,
  'unshift': handleUnshift as MethodHandler,
  'splice': handleSplice as MethodHandler,
})

const BLOCKED_BUILTIN_NAMES = new Set([
  'constructor',
  'toString',
  '__proto__',
  'prototype',
  'hasOwnProperty',
  'valueOf',
])

export function getBuiltinHandler(type: string): MethodHandler | undefined {
  if (BLOCKED_BUILTIN_NAMES.has(type)) return undefined
  if (!Object.prototype.hasOwnProperty.call(BUILTIN_METHODS, type)) return undefined
  const handler = BUILTIN_METHODS[type]
  return typeof handler === 'function' ? handler : undefined
}

/**
 * 兼容 shim：内建 handler 不再复制到公共 $methods。
 */
export function registerBuiltinMethods(_ctx: RuntimeContext): void {
  // no-op: execute() 从 BUILTIN_METHODS 解析内建 action
}
