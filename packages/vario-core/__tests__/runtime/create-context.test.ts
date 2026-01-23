/**
 * RuntimeContext 创建测试
 */

import { describe, it, expect } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context'

describe('createRuntimeContext', () => {
  it('应该创建基本的运行时上下文', () => {
    const ctx = createRuntimeContext({
      user: { name: 'John', age: 30 }
    })
    
    expect(ctx.user).toEqual({ name: 'John', age: 30 })
    expect(ctx.$emit).toBeDefined()
    expect(ctx.$methods).toBeDefined()
    expect(ctx._get).toBeDefined()
    expect(ctx._set).toBeDefined()
  })
  
  it('应该拒绝冲突的属性名', () => {
    expect(() => {
      createRuntimeContext({
        $emit: 'invalid'  // 冲突
      })
    }).toThrow('conflicts with system API')
    
    expect(() => {
      createRuntimeContext({
        _get: 'invalid'  // 冲突
      })
    }).toThrow('conflicts with system API')
  })
  
  it('应该支持路径访问', () => {
    const ctx = createRuntimeContext({
      user: { name: 'John', age: 30 }
    })
    
    expect(ctx._get('user.name')).toBe('John')
    expect(ctx._get('user.age')).toBe(30)
  })
  
  it('应该支持路径设置', () => {
    const ctx = createRuntimeContext({
      user: { name: 'John' }
    })
    
    ctx._set('user.age', 30)
    expect(ctx.user.age).toBe(30)
  })
  
  it('应该防止覆盖系统 API', () => {
    const ctx = createRuntimeContext()
    
    expect(() => {
      ctx.$emit = () => {}
    }).toThrow('Cannot override system API')
    
    expect(() => {
      ctx._get = () => {}
    }).toThrow('Cannot override system API')
  })
  
  it('应该支持事件触发', () => {
    const events: Array<{ event: string; data?: any }> = []
    const ctx = createRuntimeContext({}, {
      onEmit: (event, data) => {
        events.push({ event, data })
      }
    })
    
    ctx.$emit('test', { value: 123 })
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('test')
    expect(events[0].data).toEqual({ value: 123 })
  })
})
