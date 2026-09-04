/**
 * 循环上下文对象池测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createLoopContext,
  releaseLoopContext,
  getLoopContextPool,
  clearLoopContextPool
} from '../../src/runtime/loop-context-pool.js'
import { createRuntimeContext } from '../../src/runtime/create-context.js'

describe('循环上下文对象池', () => {
  beforeEach(() => {
    clearLoopContextPool()
  })

  it('应该创建循环上下文', () => {
    const parentCtx = createRuntimeContext({ count: 0 })
    const loopCtx = createLoopContext(parentCtx, 'item1', 0)
    
    expect(loopCtx.$item).toBe('item1')
    expect(loopCtx.$index).toBe(0)
    expect(loopCtx.count).toBe(0)
    expect(Object.getPrototypeOf(loopCtx)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(loopCtx)).not.toBe(parentCtx)
    releaseLoopContext(loopCtx)
  })

  it('应该复用父上下文的属性', () => {
    const parentCtx = createRuntimeContext({ user: { name: 'John' } })
    const loopCtx = createLoopContext(parentCtx, 'item', 0)
    
    expect(loopCtx.user).toEqual({ name: 'John' })
    expect(loopCtx.$item).toBe('item')
  })

  it('应该释放循环上下文且公开 pool 不跨调用保留 locals', () => {
    const pool = getLoopContextPool()
    const parentCtx = createRuntimeContext({ count: 0 })
    const loopCtx = createLoopContext(parentCtx, 'item', 0)
    releaseLoopContext(loopCtx)
    expect(pool.size).toBe(0)
  })

  it('应该清理循环相关属性', () => {
    const parentCtx = createRuntimeContext({ count: 0 })
    const loopCtx = createLoopContext(parentCtx, 'item', 0)
    loopCtx.tempVar = 'temp'
    
    releaseLoopContext(loopCtx)
    expect(Object.getPrototypeOf(loopCtx)).toBe(Object.prototype)
    
    // 再次获取应该清理了循环属性
    const newCtx = createLoopContext(parentCtx, 'newItem', 1)
    expect(newCtx.$item).toBe('newItem')
    expect(newCtx.$index).toBe(1)
  })

  it('公开 pool shim 不在全局保留 locals', () => {
    const pool = getLoopContextPool()
    const parentCtx = createRuntimeContext({ count: 0 })
    for (let i = 0; i < 5; i++) {
      const loopCtx = createLoopContext(parentCtx, `item${i}`, i)
      releaseLoopContext(loopCtx)
    }
    expect(pool.size).toBe(0)
  })

  it('MEM-1 released frame does not keep parent RuntimeContext as prototype', () => {
    const parentCtx = createRuntimeContext({ secret: 1 })
    const loopCtx = createLoopContext(parentCtx, 'item', 0)
    expect(Object.getPrototypeOf(loopCtx)).not.toBe(parentCtx)
    releaseLoopContext(loopCtx)
    expect(Object.getPrototypeOf(loopCtx)).toBe(Object.prototype)
    expect(Object.prototype.hasOwnProperty.call(loopCtx, 'secret')).toBe(false)
  })
})
