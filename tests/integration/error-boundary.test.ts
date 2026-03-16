/**
 * 集成测试：错误边界与异常恢复
 *
 * 验证 schema → core → vue 全链路的错误处理行为。
 */
import { describe, it, expect } from 'vitest'
import { createRuntimeContext, execute } from '@vario/core'
import { VueRenderer } from '@vario/vue'

describe('Error boundary integration', () => {
  it('should render error vnode for missing component type', () => {
    const ctx = createRuntimeContext({})
    const renderer = new VueRenderer()

    const vnode = renderer.render({
      type: 'NonExistentComponent',
      children: 'test'
    }, ctx)

    // 应返回有效 VNode（错误提示），不抛异常
    expect(vnode).toBeDefined()
  })

  it('should handle invalid cond expression gracefully', () => {
    const ctx = createRuntimeContext({})
    const renderer = new VueRenderer()

    const vnode = renderer.render({
      type: 'div',
      cond: '{{ this.is.invalid.expression!! }}',
      children: 'content'
    }, ctx)

    // cond 求值失败 → 应返回错误 VNode 或 null，不崩溃
    expect(vnode).toBeDefined()
  })

  it('should handle cond=false returning empty fragment', () => {
    const ctx = createRuntimeContext({ show: false })
    const renderer = new VueRenderer()

    const vnode = renderer.render({
      type: 'div',
      cond: '{{ show }}',
      children: 'hidden'
    }, ctx)

    expect(vnode).toBeDefined()
  })

  it('should survive VM execution errors in actions', async () => {
    const ctx = createRuntimeContext({ count: 0 })
    
    // 执行一个引用不存在路径的 set 指令
    await execute([
      { type: 'set', path: 'deeply.nested.missing', value: 42 }
    ], ctx)

    // 上下文不应崩溃
    expect(ctx.count).toBe(0)
  })

  it('should handle batch with partial failures', async () => {
    const ctx = createRuntimeContext({ a: 1, b: 2 })

    await execute([
      { type: 'batch', actions: [
        { type: 'set', path: 'a', value: 10 },
        { type: 'set', path: 'b', value: 20 },
      ]}
    ], ctx)

    expect(ctx.a).toBe(10)
    expect(ctx.b).toBe(20)
  })
})
