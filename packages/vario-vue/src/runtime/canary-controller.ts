import { getRuntimeMode, setRuntimeMode, type RuntimeMode } from './runtime-mode.js'

export type CanaryDecision = {
  mode: RuntimeMode
  reason: string
  rolledBack: boolean
  unit: 'session' | 'tenant' | 'engine'
  at: string
}

export function evaluateCanary(options: {
  correctnessOk: boolean
  parityDiffs: number
  heapOverBudget?: boolean
  perfOverBudget?: boolean
  unit?: 'session' | 'tenant' | 'engine'
  engineId?: string
}): CanaryDecision {
  const unit = options.unit ?? 'session'
  const at = new Date().toISOString()
  if (!options.correctnessOk || options.parityDiffs > 0) {
    if (unit === 'engine' || unit === 'tenant' || (unit === 'session' && options.engineId)) {
      setRuntimeMode('legacy', options.engineId ? { engineId: options.engineId } : undefined)
    }
    return { mode: 'legacy', reason: 'correctness/parity', rolledBack: true, unit, at }
  }
  if (options.heapOverBudget || options.perfOverBudget) {
    return { mode: getRuntimeMode(), reason: 'perf/heap stop-expand', rolledBack: false, unit, at }
  }
  return { mode: getRuntimeMode(), reason: 'hold', rolledBack: false, unit, at }
}
