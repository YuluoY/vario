/**
 * 集成测试：表达式安全沙箱跨层验证
 *
 * 验证 core 沙箱在 vue renderer + schema 协作下依然有效。
 */
import { describe, it, expect } from 'vitest'
import { createRuntimeContext, evaluate } from '@vario/core'
import { VueRenderer } from '@vario/vue'

describe('Expression sandbox integration', () => {
  it('should block constructor access through schema expression', () => {
    const ctx = createRuntimeContext({ user: { name: 'test' } })
    expect(() => evaluate('user.constructor', ctx)).toThrow()
  })

  it('should block __proto__ access in render context', () => {
    const ctx = createRuntimeContext({ items: [1, 2, 3] })
    expect(() => evaluate('items.__proto__', ctx)).toThrow()
  })

  it('should allow whitelisted functions in expressions', () => {
    const ctx = createRuntimeContext({ values: [3, 1, 2] })
    const result = evaluate('Math.max(1, 2, 3)', ctx)
    expect(result).toBe(3)
  })

  it('should reject eval-like functions even if injected into context', () => {
    const ctx = createRuntimeContext({ count: 0 }) as any
    ctx.eval = eval
    expect(() => evaluate('eval("1+1")', ctx)).toThrow()
  })

  it('should render schema with safe expressions end-to-end', () => {
    const ctx = createRuntimeContext({ visible: true, count: 5 })
    const renderer = new VueRenderer()

    const vnode = renderer.render({
      type: 'div',
      cond: '{{ count > 0 }}',
      children: [{ type: 'span', children: '{{ Math.max(count, 10) }}' }]
    }, ctx)

    expect(vnode).toBeDefined()
  })
})
