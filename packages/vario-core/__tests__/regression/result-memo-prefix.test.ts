/**
 * 回归测试：ResultMemo 前缀失效（FR-2 memo 部分）
 *
 * - bump('items') 失效 items.length / items.0.name（父路径替换传播）
 * - bump('items.0.name') 失效 items.0（祖先传播）
 * - 对象/数组结果不入 memo
 * - undefined 结果不入 memo
 */

import { describe, it, expect } from 'vitest'
import { ResultMemo } from '../../src/expression/result-memo.js'

describe('ResultMemo 前缀失效', () => {
  it('bump("items") 失效 items.length', () => {
    const memo = new ResultMemo({ sessionId: 't' })
    memo.store('plan.length', ['items.length'], 3)
    expect(memo.lookup('plan.length', ['items.length']).hit).toBe(true)
    memo.bump('items')
    expect(memo.lookup('plan.length', ['items.length']).hit).toBe(false)
  })

  it('bump("items") 失效 items.0.name', () => {
    const memo = new ResultMemo({ sessionId: 't' })
    memo.store('plan.name', ['items.0.name'], 'A')
    expect(memo.lookup('plan.name', ['items.0.name']).hit).toBe(true)
    memo.bump('items')
    expect(memo.lookup('plan.name', ['items.0.name']).hit).toBe(false)
  })

  it('bump("items.0.name") 失效 items.0', () => {
    const memo = new ResultMemo({ sessionId: 't' })
    memo.store('plan.zero', ['items.0'], 1)
    expect(memo.lookup('plan.zero', ['items.0']).hit).toBe(true)
    memo.bump('items.0.name')
    expect(memo.lookup('plan.zero', ['items.0']).hit).toBe(false)
  })

  it('bump("form") 失效 form.name（父路径替换）', () => {
    const memo = new ResultMemo({ sessionId: 't' })
    memo.store('plan.fname', ['form.name'], 'x')
    memo.bump('form')
    expect(memo.lookup('plan.fname', ['form.name']).hit).toBe(false)
  })

  it('不相关路径 bump 不影响其它依赖', () => {
    const memo = new ResultMemo({ sessionId: 't' })
    memo.store('plan.a', ['items.0.name'], 'A')
    memo.bump('other.path')
    expect(memo.lookup('plan.a', ['items.0.name']).hit).toBe(true)
  })

  it('对象结果不入 memo', () => {
    const memo = new ResultMemo({ sessionId: 't' })
    memo.store('plan.obj', ['items'], { a: 1 })
    expect(memo.lookup('plan.obj', ['items']).hit).toBe(false)
  })

  it('数组结果不入 memo', () => {
    const memo = new ResultMemo({ sessionId: 't' })
    memo.store('plan.arr', ['list'], [1, 2])
    expect(memo.lookup('plan.arr', ['list']).hit).toBe(false)
  })

  it('undefined 结果不入 memo', () => {
    const memo = new ResultMemo({ sessionId: 't' })
    memo.store('plan.nil', ['maybe'], undefined)
    expect(memo.lookup('plan.nil', ['maybe']).hit).toBe(false)
  })

  it('null 结果可入 memo（cacheable 规则与 evaluate.ts 对齐）', () => {
    const memo = new ResultMemo({ sessionId: 't' })
    memo.store('plan.null', ['maybe'], null)
    expect(memo.lookup('plan.null', ['maybe']).hit).toBe(true)
  })

  it('clear() 同步清空依赖索引', () => {
    const memo = new ResultMemo({ sessionId: 't' })
    memo.store('plan.x', ['items.length'], 1)
    memo.clear()
    memo.store('plan.x', ['items.length'], 2)
    memo.bump('items')
    expect(memo.lookup('plan.x', ['items.length']).hit).toBe(false)
  })
})
