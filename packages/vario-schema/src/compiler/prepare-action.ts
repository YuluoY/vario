import type { Action, SchemaNode } from '@variojs/types'
import { normalizeEventHandler } from '../event-handler.js'
import { validateActionPayload } from '../action-contract.js'

export type PreparedActionMap = Readonly<Record<string, readonly Action[]>>

export function compileNodeActions(node: SchemaNode): PreparedActionMap {
  const events = (node as { events?: Record<string, unknown> }).events
  if (!events) return Object.freeze({})
  const out: Record<string, readonly Action[]> = {}
  for (const [key, handler] of Object.entries(events)) {
    const actions = normalizeEventHandler(handler as never)
    const frozen = Object.freeze(actions.map(action => {
      validateActionPayload(action)
      return Object.freeze(action)
    }))
    out[key] = frozen
  }
  return Object.freeze(out)
}
