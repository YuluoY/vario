import type { ChangeRecord, ChangeSet } from '@variojs/types'

export type ChangeListener = (changeSet: ChangeSet) => void

let nextId = 1
const pending = new WeakMap<object, ChangeRecord[]>()
const depth = new WeakMap<object, number>()
const listeners = new WeakMap<object, Set<ChangeListener>>()

export function subscribeChangeSet(owner: object, listener: ChangeListener): () => void {
  let set = listeners.get(owner)
  if (!set) {
    set = new Set()
    listeners.set(owner, set)
  }
  set.add(listener)
  return () => {
    set?.delete(listener)
  }
}

export function beginChangeTransaction(owner: object): void {
  depth.set(owner, (depth.get(owner) ?? 0) + 1)
}

export function endChangeTransaction(owner: object): void {
  const next = (depth.get(owner) ?? 1) - 1
  depth.set(owner, Math.max(0, next))
  if (next <= 0) flushChangeSet(owner)
}

export function recordChange(owner: object, path: string, value: unknown): void {
  const list = pending.get(owner) ?? []
  list.push({ path, value })
  pending.set(owner, list)
  if ((depth.get(owner) ?? 0) === 0) flushChangeSet(owner)
}

export function flushChangeSet(owner: object): ChangeSet | null {
  const records = pending.get(owner)
  if (!records || records.length === 0) return null
  pending.set(owner, [])
  const versions: Record<string, number> = {}
  for (const record of records) {
    versions[record.path] = (versions[record.path] ?? 0) + 1
  }
  const id = nextId++
  const changeSet: ChangeSet = Object.freeze({
    id,
    transactionId: `tx_${id}`,
    paths: Object.freeze(records.map(r => r.path)),
    records: Object.freeze(records.slice()),
    versions: Object.freeze(versions)
  })
  const set = listeners.get(owner)
  if (set) {
    for (const listener of set) {
      try {
        listener(changeSet)
      } catch {
        // listener throw 不影响写路径
      }
    }
  }
  return changeSet
}
