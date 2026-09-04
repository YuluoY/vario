export type ResidentPage = {
  status: string
  pause(): void
  resume(): void
  dispose(): void
  activate?(): void
}

export type PageSessionManagerOptions = {
  maxResidentPages?: number
  maxHeapBytes?: number
}

type ResidentRecord<T extends ResidentPage> = {
  session: T
  lastUsed: number
  heapBytes: number
}

export class PageSessionManager<T extends ResidentPage = ResidentPage> {
  readonly pages = new Map<string, ResidentRecord<T>>()

  constructor(readonly options: PageSessionManagerOptions = {}) {}

  get maxResidentPages(): number {
    return this.options.maxResidentPages ?? 8
  }

  register(id: string, session: T, heapBytes = 0): void {
    this.pages.set(id, { session, lastUsed: Date.now(), heapBytes })
    this.evict()
  }

  touch(id: string): void {
    const record = this.pages.get(id)
    if (record) record.lastUsed = Date.now()
  }

  activate(id: string): void {
    const record = this.pages.get(id)
    if (!record) return
    if (record.session.status === 'disposed') return
    if (typeof record.session.activate === 'function') record.session.activate()
    else record.session.resume()
    record.lastUsed = Date.now()
  }

  pause(id: string): void {
    const record = this.pages.get(id)
    if (!record || record.session.status === 'disposed') return
    record.session.pause()
  }

  dispose(id: string): void {
    const record = this.pages.get(id)
    if (!record) return
    record.session.dispose()
    this.pages.delete(id)
  }

  disposeAll(): void {
    for (const id of [...this.pages.keys()]) this.dispose(id)
  }

  private evict(): void {
    const maxHeap = this.options.maxHeapBytes
    if (typeof maxHeap === 'number') {
      let total = [...this.pages.values()].reduce((sum, record) => sum + record.heapBytes, 0)
      while (total > maxHeap && this.pages.size > 0) {
        const victim = this.lruId(true)
        if (!victim) break
        total -= this.pages.get(victim)?.heapBytes ?? 0
        this.dispose(victim)
      }
    }
    while (this.pages.size > this.maxResidentPages) {
      const victim = this.lruId(false) ?? this.lruId(true)
      if (!victim) break
      this.dispose(victim)
    }
  }

  private lruId(includeActive: boolean): string | null {
    let oldestId: string | null = null
    let oldest = Infinity
    for (const [id, record] of this.pages) {
      if (!includeActive && record.session.status === 'active') continue
      if (record.lastUsed < oldest) {
        oldest = record.lastUsed
        oldestId = id
      }
    }
    return oldestId
  }
}
