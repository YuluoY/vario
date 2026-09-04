import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

describe('T3.9 loop/slot performance baseline', () => {
  it('loop-slot.json records runner protocol', () => {
    const file = join(dirname(fileURLToPath(import.meta.url)), '../../../../benchmarks/vue-depth/baseline/loop-slot.json')
    const report = JSON.parse(readFileSync(file, 'utf8')) as { warmup: number; samples: number; processCount: number }
    expect(report.warmup).toBe(20)
    expect(report.samples).toBe(50)
    expect(report.processCount).toBe(3)
  })
})
