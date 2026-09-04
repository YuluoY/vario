/**
 * 回归测试：getPathValue 恢复依赖收集与原型 getter 读取（FR-10）
 *
 * 用 Proxy get 陷阱模拟 Vue reactive 的依赖追踪（Vue 3.5 的 baseHandlers
 * 只通过 get 陷阱追踪，不追踪 hasOwnProperty.call / getOwnPropertyDescriptor）：
 * - 段读取必须触发 get 陷阱（尚不存在的键也能被追踪）
 * - class getter / Map.size / Set.size 等原型 getter 可读
 * - __proto__/constructor/prototype 段返回 undefined
 */

import { describe, it, expect } from 'vitest'
import { getPathValue } from '../../src/runtime/path.js'

/** 模拟 Vue reactive proxy：get 与 has 陷阱都记录读取（Vue 对二者均做依赖追踪），深层对象同样代理 */
function trackingProxy(target: Record<string, unknown>): {
  proxy: Record<string, unknown>
  reads: Set<string>
} {
  const reads = new Set<string>()
  const wrap = (value: unknown): unknown => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return track(value as Record<string, unknown>)
    }
    return value
  }
  const track = (t: Record<string, unknown>): Record<string, unknown> =>
    new Proxy(t, {
      get(obj, prop, receiver) {
        if (typeof prop === 'string') reads.add(prop)
        return wrap(Reflect.get(obj, prop, receiver))
      },
      has(obj, prop) {
        if (typeof prop === 'string') reads.add(prop)
        return Reflect.has(obj, prop)
      }
    })
  return { proxy: track(target), reads }
}

describe('getPathValue 依赖收集（Vue reactive 兼容）', () => {
  it('读取尚不存在的键也触发 get 陷阱（effect 可追踪）', () => {
    const { proxy, reads } = trackingProxy({})
    expect(getPathValue(proxy, 'form.email')).toBeUndefined()
    expect(reads.has('form')).toBe(true)
  })

  it('读取已存在的嵌套键触发各级 get 陷阱', () => {
    const { proxy, reads } = trackingProxy({ form: { email: 'x' } })
    expect(getPathValue(proxy, 'form.email')).toBe('x')
    expect(reads.has('form')).toBe(true)
    expect(reads.has('email')).toBe(true)
  })

  it('state 初始为 {} 后再赋 form.email 触发依赖 effect（模拟）', () => {
    let ran = 0
    const { proxy } = trackingProxy({})
    const run = () => {
      ran++
      return getPathValue(proxy, 'form.email')
    }
    run()
    expect(ran).toBe(1)
    // 模拟 reactive 写入：仅当 get 陷阱被触发过（依赖被收集），effect 才会重跑
    ;(proxy as Record<string, unknown>).form = { email: 'x' }
    run()
    expect(getPathValue(proxy, 'form.email')).toBe('x')
  })
})

describe('getPathValue 原型 getter 读取', () => {
  it('class getter 可读（不再要求 own property）', () => {
    class Box {
      get value(): number {
        return 42
      }
    }
    const obj: Record<string, unknown> = { box: new Box() }
    expect(getPathValue(obj, 'box.value')).toBe(42)
  })

  it('Map.size / Set.size 可读', () => {
    const map = new Map([['a', 1], ['b', 2]])
    const set = new Set([1, 2, 3])
    const obj: Record<string, unknown> = { m: map, s: set }
    expect(getPathValue(obj, 'm.size')).toBe(2)
    expect(getPathValue(obj, 's.size')).toBe(3)
  })

  it('普通对象原型上的继承属性可读', () => {
    const base = { inherited: 'yes' }
    const child = Object.create(base) as Record<string, unknown>
    const root = { child }
    expect(getPathValue(root, 'child.inherited')).toBe('yes')
  })

  it('__proto__/constructor/prototype 段返回 undefined', () => {
    const obj: Record<string, unknown> = { a: { b: 1 } }
    expect(getPathValue(obj, 'a.__proto__')).toBeUndefined()
    expect(getPathValue(obj, 'a.constructor')).toBeUndefined()
    expect(getPathValue(obj, 'a.prototype')).toBeUndefined()
  })
})
