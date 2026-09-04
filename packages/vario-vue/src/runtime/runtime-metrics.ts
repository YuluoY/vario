import { createDiagnosticSink, type DiagnosticSink } from '@variojs/core'

export type RuntimeMetric = {
  name: string
  sessionId?: string
  nodeId?: string
  planId?: string
  executionId?: string
  durationMs?: number
  count?: number
  engineId?: string
  pageId?: string
  schemaId?: string
  revision?: number
  actionId?: string
  expressionId?: string
}

const sink: DiagnosticSink = createDiagnosticSink()

export function recordRuntimeMetric(metric: RuntimeMetric, target: DiagnosticSink = sink): void {
  target.emit(metric)
}

export function recordInteractionBudget(input: {
  nodeId?: string
  actionId?: string
  sessionId?: string
  durationMs: number
}, target?: DiagnosticSink): void {
  recordRuntimeMetric({
    name: 'interaction',
    nodeId: input.nodeId,
    executionId: input.actionId,
    sessionId: input.sessionId,
    durationMs: input.durationMs
  }, target)
}

export function createRuntimeMetricsSink(inner?: DiagnosticSink): DiagnosticSink {
  return createDiagnosticSink(inner, { sampleRate: 1, maxQueue: 256 })
}
