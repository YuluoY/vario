/**
 * SEC-5/SEC-6：表达式不可 mutation，exact method allowlist。
 */
import { describe, it, expect } from 'vitest'
import { createRuntimeContext, evaluate, registerCapability } from '../../src/index.js'

describe('expression purity and allowlist', () => {
  it('SEC-5: 不能原地修改 state / prototype', () => {
    const ctx = createRuntimeContext({ items: [3, 1, 2], user: { name: 'a' } })
    expect(() => evaluate('items.reverse()', ctx)).toThrow()
    expect(() => evaluate('items.sort()', ctx)).toThrow()
    expect(ctx._get('items')).toEqual([3, 1, 2])
    expect(() => evaluate('Object.assign(user, { x: 1 })', ctx)).toThrow()
    expect(ctx._get('user')).toEqual({ name: 'a' })
  })

  it('SEC-6: Object.* 只读方法放行、危险方法与任意 $* 必须失败', () => {
    const ctx = createRuntimeContext({ n: 1 })
    // 恢复 HEAD 可用面：Object.keys/values/entries 等只读静态方法放行（FR-4）
    expect(evaluate('Object.keys({ a: n })', ctx)).toEqual(['a'])
    expect(() => evaluate('Object.assign({}, n)', ctx)).toThrow()
    expect(() => evaluate('Object.defineProperty({}, "x", {})', ctx)).toThrow()
    expect(() => evaluate('$emit("x")', ctx)).toThrow()
    expect(() => evaluate('$foo.bar()', ctx)).toThrow()
  })

  it('允许 exact 白名单与只读数组方法', () => {
    const ctx = createRuntimeContext({ items: [1, 2, 3], a: 1, b: 4 })
    expect(evaluate('Math.max(a, b)', ctx)).toBe(4)
    expect(evaluate('Array.isArray(items)', ctx)).toBe(true)
    expect(evaluate('items.slice(0, 1)', ctx)).toEqual([1])
    expect(ctx._get('items')).toEqual([1, 2, 3])
  })

  it('仅允许已注册的 $utils/$functions', () => {
    const ctx = createRuntimeContext({ n: 2 })
    registerCapability({
      name: '$utils.double',
      pure: true,
      cost: 1,
      inputLimit: 1,
      allowInExpression: true,
      impl: (x: unknown) => Number(x) * 2
    })
    expect(evaluate('$utils.double(n)', ctx)).toBe(4)
    expect(() => evaluate('$utils.missing(n)', ctx)).toThrow()
  })

  it('SEC-8 fuzz rejects unregistered, forbidden, and malformed capabilities', () => {
    const ctx = createRuntimeContext({ n: 1 })
    expect(() => registerCapability({
      name: '$utils.constructor',
      pure: true,
      cost: 1,
      inputLimit: 0,
      allowInExpression: true,
      impl: () => 1
    })).toThrow(/forbidden/)
    expect(() => registerCapability({
      name: '$emit.ping',
      pure: true,
      cost: 1,
      inputLimit: 0,
      allowInExpression: true,
      impl: () => 1
    })).toThrow(/root/)
    const names = ['constructor', '__proto__', 'prototype', 'then', 'eval', 'Function', `x${Math.random().toString(36).slice(2)}`]
    for (const name of names) {
      expect(() => evaluate(`$utils.${name}()`, ctx)).toThrow()
    }
    for (let i = 0; i < 80; i++) {
      expect(() => evaluate(`$utils.fuzz${i}(1, 2, 3)`, ctx)).toThrow()
    }
  })
})
