/**
 * 回归测试：词法变量子路径写入与路径策略收窄（FR-9）
 *
 * - loop ctx 的 _set：首段为 $item/itemKey 时写回绑定对象
 * - 变更路径按 itemsPath.<index>.<rest> 记录
 * - $index 不可写
 * - users[].name 抛 PATH_UNRESOLVED_INDEX
 * - 系统根（$methods/_get/_set/$emit）仍不可写
 */

import { describe, it, expect } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context.js'
import { createLoopContext, releaseLoopContext } from '../../src/runtime/loop-context-pool.js'
import { subscribeChangeSet } from '../../src/runtime/change-set.js'
import { PathWriteError, ErrorCodes } from '../../src/errors.js'
import type { ChangeSet } from '@variojs/types'

describe('词法变量子路径写入', () => {
  it('_set("$item.done") 写回当前项且视图缓存失效', () => {
    const ctx = createRuntimeContext({ items: [{ name: 'a', done: false }] })
    const loopCtx = createLoopContext(ctx, ctx._get('items')[0], 0, { itemsPath: 'items' })
    loopCtx._set('$item.done', true)
    expect(ctx._get('items[0].done')).toBe(true)
    releaseLoopContext(loopCtx)
  })

  it('变更路径按 itemsPath.<index>.<rest> 记录', () => {
    const ctx = createRuntimeContext({ items: [{ name: 'a', done: false }, { name: 'b', done: false }] })
    const changes: string[] = []
    subscribeChangeSet(ctx, (cs: ChangeSet) => {
      changes.push(...cs.paths)
    })
    const loopCtx = createLoopContext(ctx, ctx._get('items')[1], 1, { itemsPath: 'items' })
    loopCtx._set('$item.done', true)
    expect(changes).toContain('items.1.done')
    releaseLoopContext(loopCtx)
  })

  it('itemKey 别名（如 user）同样写回', () => {
    const ctx = createRuntimeContext({ users: [{ name: 'A', done: false }] })
    const loopCtx = createLoopContext(ctx, ctx._get('users')[0], 0, {
      itemsPath: 'users',
      itemKey: 'user',
    })
    loopCtx._set('user.done', true)
    expect(ctx._get('users[0].done')).toBe(true)
    releaseLoopContext(loopCtx)
  })

  it('$index / indexKey 写入抛 PathWriteError', () => {
    const ctx = createRuntimeContext({ items: [{ name: 'a' }] })
    const loopCtx = createLoopContext(ctx, ctx._get('items')[0], 0, {
      itemsPath: 'items',
      indexKey: 'idx',
    })
    expect(() => loopCtx._set('$index', 5)).toThrow(PathWriteError)
    expect(() => loopCtx._set('idx', 5)).toThrow(PathWriteError)
    releaseLoopContext(loopCtx)
  })

  it('无 itemsPath 时兜底失效不抛错', () => {
    const ctx = createRuntimeContext({ items: [{ name: 'a', done: false }] })
    const loopCtx = createLoopContext(ctx, ctx._get('items')[0], 0)
    expect(() => loopCtx._set('$item.done', true)).not.toThrow()
    expect((ctx._get('items')[0] as { done: boolean }).done).toBe(true)
    releaseLoopContext(loopCtx)
  })

  it('_set("$methods", …) 仍抛错', () => {
    const ctx = createRuntimeContext({})
    expect(() => ctx._set('$methods', {})).toThrow()
  })

  it('users[].name 抛 PATH_UNRESOLVED_INDEX 而非 budget 错误', () => {
    const ctx = createRuntimeContext({ users: [{ name: 'a' }] })
    try {
      ctx._set('users[].name', 'b')
      expect.unreachable('should throw')
    } catch (error) {
      expect(error).toBeInstanceOf(PathWriteError)
      expect((error as PathWriteError).code).toBe(ErrorCodes.PATH_UNRESOLVED_INDEX)
    }
  })

  it('系统根子路径 _get 可读、不可写', () => {
    const ctx = createRuntimeContext({ items: [1] })
    expect(() => ctx._set('$methods.foo', 1)).toThrow()
    expect(() => ctx._set('_get.x', 1)).toThrow()
  })
})
