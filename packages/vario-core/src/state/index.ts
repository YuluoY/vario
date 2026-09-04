import { VarioError, ErrorCodes } from '../errors.js'
import {
  beginChangeTransaction,
  endChangeTransaction,
  flushChangeSet,
  recordChange,
  subscribeChangeSet,
  type ChangeListener
} from '../runtime/change-set.js'

const pausedOwners = new WeakSet<object>()

export function isOwnerPaused(owner: object): boolean {
  return pausedOwners.has(owner)
}

export class StateStore {
  revision = 0
  private readonly pathVersions = new Map<string, number>()
  private disposed = false
  private silent = false
  private held: string[] | null = null

  constructor(private readonly owner: object) {}

  subscribe(listener: ChangeListener): () => void {
    return subscribeChangeSet(this.owner, changeSet => {
      if (this.disposed) return
      if (this.silent) {
        (this.held ??= []).push(...changeSet.paths)
        return
      }
      this.revision += 1
      for (const path of changeSet.paths) {
        this.pathVersions.set(path, (this.pathVersions.get(path) ?? 0) + 1)
      }
      listener(changeSet)
    })
  }

  read(path: string): unknown {
    const owner = this.owner as { _get?: (p: string) => unknown }
    if (typeof owner._get === 'function') return owner._get(path)
    return undefined
  }

  write(path: string, value: unknown): void {
    if (this.disposed) {
      throw new VarioError('Session disposed', ErrorCodes.SESSION_DISPOSED)
    }
    const owner = this.owner as { _set?: (p: string, v: unknown) => void }
    if (typeof owner._set === 'function') {
      owner._set(path, value)
      return
    }
    recordChange(this.owner, path, value)
  }

  mutate(path: string, updater: (current: unknown) => unknown): void {
    this.write(path, updater(this.read(path)))
  }

  version(path?: string): number {
    if (path == null || path === '') return this.revision
    return this.pathVersions.get(path) ?? 0
  }

  pathVersion(path: string): number {
    return this.version(path)
  }

  batch(fn: () => void): void {
    beginChangeTransaction(this.owner)
    try {
      fn()
    } finally {
      endChangeTransaction(this.owner)
    }
  }

  flush() {
    return flushChangeSet(this.owner)
  }

  pause(): void {
    this.silent = true
    pausedOwners.add(this.owner)
  }

  resume(): void {
    pausedOwners.delete(this.owner)
    this.silent = false
    const paths = this.held
    this.held = null
    if (!paths?.length || this.disposed) return
    beginChangeTransaction(this.owner)
    try {
      for (const path of paths) recordChange(this.owner, path, this.read(path))
    } finally {
      endChangeTransaction(this.owner)
    }
  }

  dispose(): void {
    this.disposed = true
    this.held = null
    pausedOwners.delete(this.owner)
  }
}
