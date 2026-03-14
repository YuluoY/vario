/**
 * log 动作处理器测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRuntimeContext } from '../../../src/runtime/create-context.js'
import { execute } from '../../../src/vm/executor.js'

describe('log 动作', () => {
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    ctx = createRuntimeContext({
      userName: 'Alice',
      count: 42
    })
  })

  it('应该输出 info 日志', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await execute([
      { type: 'log', message: 'Hello World' }
    ], ctx)

    expect(logSpy).toHaveBeenCalledWith('[Vario]', 'Hello World')
    logSpy.mockRestore()
  })

  it('应该支持 warn 级别', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await execute([
      { type: 'log', level: 'warn', message: 'Warning!' }
    ], ctx)

    expect(warnSpy).toHaveBeenCalledWith('[Vario]', 'Warning!')
    warnSpy.mockRestore()
  })

  it('应该支持 error 级别', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await execute([
      { type: 'log', level: 'error', message: 'Error occurred' }
    ], ctx)

    expect(errorSpy).toHaveBeenCalledWith('[Vario]', 'Error occurred')
    errorSpy.mockRestore()
  })

  it('应该支持表达式消息', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await execute([
      { type: 'log', message: '{{ userName }}' }
    ], ctx)

    expect(logSpy).toHaveBeenCalledWith('[Vario]', 'Alice')
    logSpy.mockRestore()
  })

  it('应该在缺少 message 参数时抛出错误', async () => {
    await expect(
      execute([{ type: 'log' }], ctx)
    ).rejects.toThrow('message')
  })

  it('默认 level 应为 info', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await execute([
      { type: 'log', message: 'default level' }
    ], ctx)

    expect(logSpy).toHaveBeenCalledWith('[Vario]', 'default level')
    logSpy.mockRestore()
  })
})
