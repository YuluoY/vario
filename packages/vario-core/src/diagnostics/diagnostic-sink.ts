import type { VarioDiagnostic } from '@variojs/types'

export type DiagnosticEvent = {
  readonly name: string
  readonly sessionId?: string
  readonly nodeId?: string
  readonly planId?: string
  readonly executionId?: string
  readonly durationMs?: number
  readonly count?: number
  readonly engineId?: string
  readonly pageId?: string
  readonly schemaId?: string
  readonly revision?: number
  readonly actionId?: string
  readonly expressionId?: string
  readonly diagnostic?: VarioDiagnostic
}

export type DiagnosticSink = {
  emit: (event: DiagnosticEvent) => void
}

export type SinkOptions = {
  sampleRate?: number
  maxQueue?: number
}

const SENSITIVE = /state|token|payload|password|secret|expression|stack/i
const SENSITIVE_META = new Set(['state', 'token', 'payload', 'password', 'secret', 'expression', 'stack', 'event'])

function sanitizeEvent(event: DiagnosticEvent): DiagnosticEvent {
  if (!event.diagnostic) return event
  const diagnostic = { ...event.diagnostic }
  if (SENSITIVE.test(diagnostic.message)) {
    diagnostic.message = diagnostic.code
  }
  if (diagnostic.metadata) {
    const metadata: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(diagnostic.metadata)) {
      if (SENSITIVE_META.has(key) || SENSITIVE.test(key)) continue
      if (typeof value === 'string' && SENSITIVE.test(value)) continue
      metadata[key] = value
    }
    diagnostic.metadata = metadata
  }
  return { ...event, diagnostic }
}

export function createDiagnosticSink(
  inner?: DiagnosticSink,
  options: SinkOptions = {}
): DiagnosticSink {
  const sampleRate = options.sampleRate ?? 1
  const maxQueue = options.maxQueue ?? 256
  let queued = 0

  return {
    emit(event: DiagnosticEvent): void {
      if (sampleRate < 1 && Math.random() > sampleRate) return
      if (queued >= maxQueue) return
      event = sanitizeEvent(event)
      if (!inner) return
      queued++
      try {
        inner.emit(event)
      } catch {
        // sink throw 不影响业务
      } finally {
        queued--
      }
    }
  }
}

export const noopDiagnosticSink: DiagnosticSink = {
  emit() {}
}
