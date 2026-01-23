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
 * 注册所有内置动作到 $methods
 */
export function registerBuiltinMethods(ctx: RuntimeContext): void {
  // 动作处理器作为特殊的方法注册，参数是 Action
  ctx.$methods = {
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
    
    // 保留已有的方法（允许覆盖或扩展）
    ...ctx.$methods
  }
}
