import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRuntimeContext } from '@variojs/core'
import { prepareView } from '@variojs/schema'
import { PageSession, activePageSessionCount } from '../../src/runtime/page-session.js'

describe('T4.8 session memory', () => {
  it('100 create/dispose leaves zero live sessions', () => {
    const before = activePageSessionCount()
    const sessions = Array.from({ length: 100 }, (_, i) => new PageSession({
      ctx: createRuntimeContext({ n: i }),
      view: prepareView({ type: 'div', children: '{{ n }}' } as never)
    }))
    for (const session of sessions) session.dispose()
    expect(sessions.every(s => s.status === 'disposed')).toBe(true)
    expect(activePageSessionCount()).toBe(before)
  })

  it('AC-18 library criterion: mem2Slope ≤ emptySlope and constructorCounts=0', () => {
    const report = JSON.parse(readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../../benchmarks/vue-depth/baseline/ssr-memory.json'),
      'utf8'
    )) as {
      mem2Slope: number
      emptySlope: number
      mem3Live: number
      constructorCounts: Record<string, number>
    }
    expect(report.mem2Slope).toBeLessThanOrEqual(report.emptySlope)
    expect(report.mem3Live).toBe(0)
    expect(report.constructorCounts).toEqual({
      PageSession: 0,
      RuntimeContext: 0,
      VueStateBridge: 0,
      RuntimeSession: 0
    })
  })
})
