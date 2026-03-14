/**
 * navigate 动作处理器测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRuntimeContext } from '../../../src/runtime/create-context.js'
import { execute } from '../../../src/vm/executor.js'

describe('navigate 动作', () => {
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    ctx = createRuntimeContext({
      targetUrl: '/dashboard'
    })
  })

  it('应该调用已注册的 $navigate 方法', async () => {
    const navigateFn = vi.fn()
    ctx.$methods['$navigate'] = async (_ctx, params: any) => {
      navigateFn(params.to)
    }

    await execute([
      { type: 'navigate', to: '/users' }
    ], ctx)

    expect(navigateFn).toHaveBeenCalledWith('/users')
  })

  it('应该在缺少 to 参数时抛出错误', async () => {
    await expect(
      execute([{ type: 'navigate' }], ctx)
    ).rejects.toThrow('to')
  })

  it('应该支持表达式路径', async () => {
    const navigateFn = vi.fn()
    ctx.$methods['$navigate'] = async (_ctx, params: any) => {
      navigateFn(params.to)
    }

    await execute([
      { type: 'navigate', to: '{{ targetUrl }}' }
    ], ctx)

    expect(navigateFn).toHaveBeenCalledWith('/dashboard')
  })

  it('应该支持 $router 别名', async () => {
    const navigateFn = vi.fn()
    ctx.$methods['$router'] = async (_ctx, params: any) => {
      navigateFn(params.to)
    }

    await execute([
      { type: 'navigate', to: '/about' }
    ], ctx)

    expect(navigateFn).toHaveBeenCalledWith('/about')
  })

  it('应该在表达式求值为非字符串时抛出错误', async () => {
    ctx._set('targetUrl', 123 as any)

    await expect(
      execute([
        { type: 'navigate', to: '{{ targetUrl }}' }
      ], ctx)
    ).rejects.toThrow()
  })
})
