/**
 * 循环上下文对象池
 * 
 * 功能：
 * - 复用循环上下文对象，减少内存分配
 * - 提升循环性能
 * - 自动清理和重置
 */

import type { RuntimeContext } from '../types.js'

/**
 * 循环上下文对象池
 */
class LoopContextPool {
  private pool: Array<Partial<RuntimeContext>> = []
  private maxSize: number

  constructor(maxSize: number = 10) {
    this.maxSize = maxSize
  }

  /**
   * 获取一个循环上下文对象
   */
  acquire(): Partial<RuntimeContext> {
    if (this.pool.length > 0) {
      return this.pool.pop()!
    }
    return {}
  }

  /**
   * 释放循环上下文对象回池中
   */
  release(ctx: Partial<RuntimeContext>): void {
    // 清理循环相关属性
    if ('$item' in ctx) delete ctx.$item
    if ('$index' in ctx) delete ctx.$index
    
    // 清理动态添加的循环变量（保留系统 API）
    const keysToDelete: string[] = []
    for (const key in ctx) {
      if (!key.startsWith('$') && !key.startsWith('_')) {
        keysToDelete.push(key)
      }
    }
    for (const key of keysToDelete) {
      delete ctx[key]
    }
    
    // 如果池未满，回收对象
    if (this.pool.length < this.maxSize) {
      this.pool.push(ctx)
    }
  }

  /**
   * 清空对象池
   */
  clear(): void {
    this.pool.length = 0
  }

  /**
   * 获取池大小
   */
  get size(): number {
    return this.pool.length
  }
}

/**
 * 全局循环上下文对象池实例
 */
let globalPool: LoopContextPool | null = null

/**
 * 获取全局循环上下文对象池
 */
export function getLoopContextPool(): LoopContextPool {
  if (!globalPool) {
    globalPool = new LoopContextPool()
  }
  return globalPool
}

/**
 * 创建循环上下文（使用对象池）
 * 
 * @param parentCtx 父上下文
 * @param item 循环项
 * @param index 循环索引
 * @returns 循环上下文
 */
export function createLoopContext(
  parentCtx: RuntimeContext,
  item: unknown,
  index: number
): RuntimeContext {
  const pool = getLoopContextPool()
  const baseCtx = pool.acquire()
  
  // 创建循环上下文（浅拷贝父上下文 + 循环属性）
  const loopCtx = Object.create(parentCtx) as RuntimeContext
  
  // 复制基础对象池中的属性（如果有）
  Object.assign(loopCtx, baseCtx)
  
  // 设置循环相关属性
  loopCtx.$item = item
  loopCtx.$index = index
  
  return loopCtx
}

/**
 * 释放循环上下文（回收到对象池）
 * 
 * @param loopCtx 循环上下文
 */
export function releaseLoopContext(loopCtx: Partial<RuntimeContext>): void {
  const pool = getLoopContextPool()
  pool.release(loopCtx)
}

/**
 * 清空对象池（用于测试或重置）
 */
export function clearLoopContextPool(): void {
  if (globalPool) {
    globalPool.clear()
  }
}
