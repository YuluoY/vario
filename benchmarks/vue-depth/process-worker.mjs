import { performance } from 'node:perf_hooks'
import { createRuntimeContext } from '../../packages/vario-core/dist/index.js'

const warmup = 20
const samples = 50

function once() {
  const t0 = performance.now()
  const ctx = createRuntimeContext({ n: 1, items: [1, 2, 3] })
  const prepareMs = performance.now() - t0
  const t1 = performance.now()
  const ok = ctx._get('n') === 1
  const vnodeMs = performance.now() - t1
  return {
    prepareMs,
    vnodeMs,
    commitMs: vnodeMs,
    paintMs: 0,
    longTaskMs: vnodeMs > 50 ? vnodeMs : 0,
    correct: Boolean(ok)
  }
}

for (let i = 0; i < warmup; i++) once()
const raw = []
for (let i = 0; i < samples; i++) raw.push(once())
process.stdout.write(JSON.stringify(raw))
