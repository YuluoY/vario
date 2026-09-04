/**
 * EXPR-2 / R-001：loop alias 与 $item/$index 词法优先于 state path。
 */
import { describe, it, expect } from 'vitest'
import { createRuntimeContext, execute } from '../../src/index.js'

describe('lexical scope', () => {
  it('loop alias item 不被当成 state path', async () => {
    const ctx = createRuntimeContext({
      items: ['a', 'b', 'c'],
      result: [] as string[],
      item: 'STATE_SHOULD_NOT_WIN',
    })

    await execute([
      {
        type: 'loop',
        var: 'item',
        in: 'items',
        body: [
          { type: 'push', path: 'result', value: '{{ item }}' }
        ]
      }
    ], ctx)

    expect(ctx._get('result')).toEqual(['a', 'b', 'c'])
  })

  it('nested loop 内层 alias 覆盖外层同名', async () => {
    const ctx = createRuntimeContext({
      outer: [{ inner: [1, 2] }],
      result: [] as number[],
    })

    await execute([
      {
        type: 'loop',
        var: 'row',
        in: 'outer',
        body: [
          {
            type: 'loop',
            var: 'n',
            in: '{{ row.inner }}',
            body: [
              { type: 'push', path: 'result', value: '{{ n }}' }
            ]
          }
        ]
      }
    ], ctx)

    expect(ctx._get('result')).toEqual([1, 2])
  })
})
