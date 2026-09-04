/**
 * Action VM 执行器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context'
import { execute } from '../../src/vm/executor'

describe('Action VM', () => {
  let ctx: ReturnType<typeof createRuntimeContext>
  
  beforeEach(() => {
    // createRuntimeContext 现在会自动注册内置动作
    ctx = createRuntimeContext({
      user: { name: 'John', age: 30 },
      count: 0,
      items: [1, 2, 3]
    })
  })
  
  it('应该执行 set 动作', async () => {
    await execute([
      { type: 'set', path: 'count', value: 10 }
    ], ctx)
    
    expect(ctx.count).toBe(10)
  })
  
  it('应该执行 set 动作（表达式值）', async () => {
    await execute([
      { type: 'set', path: 'count', value: '{{ count + 1 }}' }
    ], ctx)
    
    expect(ctx.count).toBe(1)
  })
  
  it('应该执行 emit 动作', async () => {
    const events: Array<{ event: string; data?: any }> = []
    const ctx = createRuntimeContext({}, {
      onEmit: (event, data) => {
        events.push({ event, data })
      }
    })
    
    await execute([
      { type: 'emit', event: 'test', data: { value: 123 } }
    ], ctx)
    
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('test')
  })
  
  it('应该执行 if 动作', async () => {
    await execute([
      {
        type: 'if',
        cond: 'user.age > 18',
        then: [
          { type: 'set', path: 'isAdult', value: true }
        ],
        else: [
          { type: 'set', path: 'isAdult', value: false }
        ]
      }
    ], ctx)
    
    expect(ctx.isAdult).toBe(true)
  })
  
  it('应该执行 loop 动作', async () => {
    await execute([
      {
        type: 'loop',
        var: 'item',
        in: 'items',
        body: [
          { type: 'set', path: 'total', value: '{{ (total || 0) + item }}' }
        ]
      }
    ], ctx)
    
    expect(ctx.total).toBe(6)  // 1 + 2 + 3
  })
  
  it('应该执行 batch 动作', async () => {
    await execute([
      {
        type: 'batch',
        actions: [
          { type: 'set', path: 'a', value: 1 },
          { type: 'set', path: 'b', value: 2 }
        ]
      }
    ], ctx)
    
    expect(ctx.a).toBe(1)
    expect(ctx.b).toBe(2)
  })
  
  it('应该执行数组操作动作', async () => {
    await execute([
      { type: 'push', path: 'items', value: 4 }
    ], ctx)
    
    expect(ctx.items).toEqual([1, 2, 3, 4])
    
    await execute([
      { type: 'pop', path: 'items' }
    ], ctx)
    
    expect(ctx.items).toEqual([1, 2, 3])
  })
  
  it('应该在未知动作类型时抛出错误', async () => {
    await expect(
      execute([{ type: 'unknown' }], ctx)
    ).rejects.toThrow('Unknown action type')
  })
  
  it('应该执行 call 动作', async () => {
    ctx.$methods['test.method'] = async () => {
      return 'result'
    }
    
    await execute([
      {
        type: 'call',
        method: 'test.method',
        resultTo: 'result'
      }
    ], ctx)
    
    expect(ctx.result).toBe('result')
  })
  
  it('应该执行 navigate 动作', async () => {
    let navigatedTo: string | null = null
    ctx.$methods['navigate'] = async (ctx, params: Record<string, unknown>) => {
      navigatedTo = params.to as string
    }
    
    await execute([
      {
        type: 'navigate',
        to: '/test'
      }
    ], ctx)
    
    expect(navigatedTo).toBe('/test')
  })
  
  it('应该执行 log 动作', async () => {
    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '))
    }
    
    try {
      await execute([
        {
          type: 'log',
          level: 'info',
          message: 'Test message'
        }
      ], ctx)
      
      expect(logs.some(log => log.includes('Test message'))).toBe(true)
    } finally {
      console.log = originalLog
    }
  })

  it('does not copy builtin actions onto public $methods', async () => {
    await execute([{ type: 'set', path: 'count', value: 4 }], ctx)
    expect(ctx._get('count')).toBe(4)
    expect(ctx.$methods.set).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(ctx.$methods, 'set')).toBe(false)
  })

  it('ExecutionSession exposes id, diagnostics, scope and deadline metadata', async () => {
    const { getExecutionSession } = await import('../../src/vm/execution-session.js')
    let seen = false
    ctx.$methods.inspect = (_c, _action, meta) => {
      expect(meta?.executionId).toBeTruthy()
      expect(meta?.deadline).toBeGreaterThan(Date.now() - 1000)
      expect(meta?.signal).toBeInstanceOf(AbortSignal)
      expect(getExecutionSession(ctx)?.callStack.length).toBeGreaterThan(0)
      seen = true
    }
    await execute([{ type: 'call', method: 'inspect' }], ctx)
    expect(seen).toBe(true)
    // execute 结束后 session 必须解绑，不得残留（FR-1 / AC-1）
    expect(getExecutionSession(ctx)).toBeUndefined()
  })
})
