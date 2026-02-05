/**
 * call 指令处理器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createRuntimeContext } from '../../../src/runtime/create-context'
import { execute } from '../../../src/vm/executor'
import { InstructionError, ServiceError } from '../../../src/types'

describe('call 指令', () => {
  let ctx: ReturnType<typeof createRuntimeContext>
  
  beforeEach(() => {
    // createRuntimeContext 现在会自动注册内置指令
    ctx = createRuntimeContext({
      user: { name: 'John', age: 30 },
      result: null
    })
  })
  
  it('应该调用已注册的方法', async () => {
    // 注册一个测试方法
    ctx.$methods['test.method'] = async (ctx, params: Record<string, unknown>) => {
      return { success: true, value: params.value }
    }
    
    await execute([
      {
        type: 'call',
        method: 'test.method',
        params: { value: 123 }
      }
    ], ctx)
  })
  
  it('应该将结果保存到 resultTo', async () => {
    ctx.$methods['test.return'] = async () => {
      return { data: 'result' }
    }
    
    await execute([
      {
        type: 'call',
        method: 'test.return',
        resultTo: 'result'
      }
    ], ctx)
    
    expect(ctx.result).toEqual({ data: 'result' })
  })
  
  it('应该支持表达式参数', async () => {
    ctx.$methods['test.echo'] = async (ctx, params: Record<string, unknown>) => {
      return params.value
    }
    
    await execute([
      {
        type: 'call',
        method: 'test.echo',
        params: {
          value: '{{ user.name }}'
        }
      }
    ], ctx)
  })
  
  it('应该在方法不存在时抛出错误', async () => {
    await expect(
      execute([
        {
          type: 'call',
          method: 'nonexistent.method'
        }
      ], ctx)
    ).rejects.toThrow(InstructionError)
  })
  
  it('应该在方法执行失败时抛出 ServiceError', async () => {
    ctx.$methods['test.error'] = async () => {
      throw new Error('Test error')
    }
    
    await expect(
      execute([
        {
          type: 'call',
          method: 'test.error'
        }
      ], ctx)
    ).rejects.toThrow(ServiceError)
  })
  
  it('应该支持 params 数组形式（位置参数）', async () => {
    ctx.$methods['test.array'] = async (ctx, params: unknown) => {
      // 验证接收到的是数组
      expect(Array.isArray(params)).toBe(true)
      return params
    }
    
    await execute([
      {
        type: 'call',
        method: 'test.array',
        params: ['{{ user.name }}', 30, true],
        resultTo: 'result'
      }
    ], ctx)
    
    expect(ctx.result).toEqual(['John', 30, true])
  })
  
  it('应该支持 params 对象形式（命名参数）', async () => {
    ctx.$methods['test.object'] = async (ctx, params: unknown) => {
      expect(typeof params === 'object' && !Array.isArray(params)).toBe(true)
      return params
    }
    
    await execute([
      {
        type: 'call',
        method: 'test.object',
        params: { name: '{{ user.name }}', age: '{{ user.age }}' },
        resultTo: 'result'
      }
    ], ctx)
    
    expect(ctx.result).toEqual({ name: 'John', age: 30 })
  })
  
  it('应该对 params 数组中的表达式求值', async () => {
    ctx.$methods['test.array.eval'] = async (ctx, params: unknown) => {
      return params
    }
    
    await execute([
      {
        type: 'call',
        method: 'test.array.eval',
        params: ['{{ user.name }}', '{{ user.age + 10 }}', 'static'],
        resultTo: 'result'
      }
    ], ctx)
    
    expect(ctx.result).toEqual(['John', 40, 'static'])
  })
})
