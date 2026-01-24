/**
 * 内置动作处理器
 * 
 * 所有内置动作统一注册到 ctx.$methods
 */

import type { RuntimeContext, MethodHandler } from '@/types.js'
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
 */
const BUILTIN_METHODS: Record<string, MethodHandler> = {
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
}

/**
 * 注册所有内置动作到 $methods
 * 
 * 注意：此函数通过向现有 $methods 对象添加属性来注册方法，
 * 而不是整体覆盖 $methods，以确保在 Proxy 保护下也能正常工作。
 */
export function registerBuiltinMethods(ctx: RuntimeContext): void {
  // 向现有 $methods 对象添加内置方法，不覆盖已有的同名方法
  for (const [name, handler] of Object.entries(BUILTIN_METHODS)) {
    if (!(name in ctx.$methods)) {
      ctx.$methods[name] = handler
    }
  }
}
