/**
 * Immutable lexical ScopeFrame. Does not Object.create a parent RuntimeContext.
 */

export interface ScopeFrame {
  readonly id: string
  readonly parentId: string | null
  readonly bindings: Readonly<Record<string, unknown>>
  readonly generation: number
}

export type ScopeTable = Map<string, ScopeFrame>

let nextFrameId = 1

export function createScopeFrame(
  parent: ScopeFrame | null,
  bindings: Record<string, unknown>
): ScopeFrame {
  return Object.freeze({
    id: `scope:${nextFrameId++}`,
    parentId: parent?.id ?? null,
    bindings: Object.freeze({ ...bindings }),
    generation: (parent?.generation ?? 0) + 1
  })
}

export function lookupBinding(
  table: ScopeTable,
  frame: ScopeFrame | null,
  name: string
): { found: true; value: unknown } | { found: false } {
  let current = frame
  while (current) {
    if (Object.prototype.hasOwnProperty.call(current.bindings, name)) {
      return { found: true, value: current.bindings[name] }
    }
    current = current.parentId ? table.get(current.parentId) ?? null : null
  }
  return { found: false }
}

export function releaseScopeFrame(table: ScopeTable, frame: ScopeFrame): void {
  table.delete(frame.id)
}

export function collectFrameChain(table: ScopeTable, frame: ScopeFrame | null): ScopeFrame[] {
  const chain: ScopeFrame[] = []
  let current = frame
  while (current) {
    chain.push(current)
    current = current.parentId ? table.get(current.parentId) ?? null : null
  }
  return chain
}
