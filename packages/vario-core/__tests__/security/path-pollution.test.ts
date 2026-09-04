/**
 * SEC-1～SEC-4 / STATE-1：path 原型污染、系统路径、预算、cache 冻结与 LRU。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createRuntimeContext,
  parsePathCached,
  clearPathCache,
  getPathValue,
  setPathValue,
  PathWriteError,
} from '../../src/index.js'

describe('path pollution and write policy', () => {
  beforeEach(() => {
    clearPathCache()
  })

  it('SEC-1: __proto__/constructor/prototype 不可读写，Object.prototype 保持干净', () => {
    const ctx = createRuntimeContext({ user: { name: 'a' } })
    const proto = Object.prototype as Record<string, unknown>

    expect(() => ctx._set('__proto__.polluted', true)).toThrow(PathWriteError)
    expect(() => ctx._set('user.__proto__.x', 1)).toThrow(PathWriteError)
    expect(() => ctx._set('constructor.prototype.hacked', true)).toThrow(PathWriteError)

    expect(getPathValue({} as Record<string, unknown>, '__proto__')).toBeUndefined()
    expect(ctx._get('__proto__')).toBeUndefined()
    expect('polluted' in proto).toBe(false)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('SEC-2: 系统路径不能经 _set 覆盖', () => {
    const ctx = createRuntimeContext({ count: 1 })
    expect(() => ctx._set('$emit', (() => {}) as never)).toThrow(PathWriteError)
    expect(() => ctx._set('$methods.x', 1 as never)).toThrow(PathWriteError)
    expect(() => ctx._set('_get', (() => {}) as never)).toThrow(PathWriteError)
    expect(() => ctx._set('_set', (() => {}) as never)).toThrow(PathWriteError)
    expect(typeof ctx.$emit).toBe('function')
    expect(typeof ctx._get).toBe('function')
  })

  it('SEC-3: 超预算 path 快速失败，不分配巨型数组', () => {
    const ctx = createRuntimeContext({ items: [] as unknown[] })
    expect(() => ctx._set('items.100001', 1)).toThrow(PathWriteError)
    expect((ctx._get('items') as unknown[]).length).toBe(0)

    const deep = Array.from({ length: 21 }, (_, i) => `s${i}`).join('.')
    expect(() => ctx._set(deep, 1)).toThrow(PathWriteError)
  })

  it('SEC-4: parsePathCached 返回冻结计划，2000 边界不全清', () => {
    const segs = parsePathCached('user.name')
    expect(Object.isFrozen(segs)).toBe(true)
    expect(() => {
      ;(segs as string[]).push('x')
    }).toThrow()

    for (let i = 0; i < 2001; i++) {
      parsePathCached(`k${i}.a`)
    }
    expect(parsePathCached('k2000.a')).toEqual(['k2000', 'a'])
    expect(parsePathCached('k1999.a')).toEqual(['k1999', 'a'])
  })

  it('STATE-1: _set 失败抛 typed error，不调用成功 callback', () => {
    const calls: string[] = []
    const ctx = createRuntimeContext({ count: 1 }, {
      onStateChange: (path) => { calls.push(path) }
    })
    expect(() => ctx._set('__proto__.x', 1)).toThrow(PathWriteError)
    expect(calls).toEqual([])
    ctx._set('count', 2)
    expect(calls).toEqual(['count'])
    expect(ctx._get('count')).toBe(2)
  })

  it('SEC-1/3 fuzz rejects prototype and over-budget path payloads', () => {
    const ctx = createRuntimeContext({ items: [] as unknown[] })
    const attacks = [
      '__proto__.x',
      'constructor.prototype.y',
      'items.__proto__',
      'a.constructor.b',
      `${'n.'.repeat(21)}z`
    ]
    for (const path of attacks) {
      expect(() => ctx._set(path, 1)).toThrow(PathWriteError)
    }
    for (let i = 0; i < 40; i++) {
      expect(() => ctx._set(`__proto__.p${i}`, i)).toThrow(PathWriteError)
    }
    expect('p0' in Object.prototype).toBe(false)
  })

  it('setPathValue 拒绝 forbidden 段并返回 false', () => {
    const obj: Record<string, unknown> = {}
    expect(setPathValue(obj, '__proto__.x', 1)).toBe(false)
    expect((Object.prototype as Record<string, unknown>).x).toBeUndefined()
  })
})
