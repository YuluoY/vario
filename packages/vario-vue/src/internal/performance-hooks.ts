export type PerformanceCounters = {
  prepareNode: number
  indexWrite: number
  legacyRenderNode: number
  regionRender: number
  lrr: number
  loopCellRender: number
  expressionEval: number
  domCommit: number
  parentMapWrite: number
}

export type PerformanceHooks = {
  [K in keyof PerformanceCounters]?: () => void
}

const EMPTY: PerformanceCounters = {
  prepareNode: 0,
  indexWrite: 0,
  legacyRenderNode: 0,
  regionRender: 0,
  lrr: 0,
  loopCellRender: 0,
  expressionEval: 0,
  domCommit: 0,
  parentMapWrite: 0
}

let active: PerformanceHooks | null = null
let counters: PerformanceCounters = { ...EMPTY }

export function resetPerformanceCounters(): PerformanceCounters {
  counters = { ...EMPTY }
  return getPerformanceCounters()
}

export function getPerformanceCounters(): PerformanceCounters {
  return { ...counters }
}

export function setPerformanceHooks(hooks: PerformanceHooks | null): void {
  active = hooks
}

export function emitPerformance(event: keyof PerformanceCounters): void {
  counters[event] += 1
  const hook = active?.[event]
  if (!hook) return
  try {
    hook()
  } catch {
    // hook throw 不影响业务
  }
}
