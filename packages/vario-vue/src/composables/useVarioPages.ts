import { getCurrentInstance, onUnmounted, shallowRef, unref } from 'vue'
import { PageSessionManager } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'
import { useVario } from '../composable.js'
import type { UseVarioOptions, UseVarioResult } from '../types.js'
import { getPageSessionForContext } from '../runtime/page-session.js'

export function useVarioPages(options: { maxResidentPages?: number; maxHeapBytes?: number; runtimeBudget?: { maxActivePages?: number } } = {}) {
  const manager = new PageSessionManager({
    maxResidentPages: options.maxResidentPages ?? options.runtimeBudget?.maxActivePages ?? 8,
    maxHeapBytes: options.maxHeapBytes
  })
  const activeId = shallowRef<string | null>(null)
  const pages = new Map<string, UseVarioResult<Record<string, unknown>>>()

  function open(id: string, schema: SchemaNode, pageOptions: UseVarioOptions = {}) {
    const existing = pages.get(id)
    if (existing) {
      manager.activate(id)
      activeId.value = id
      return existing
    }
    const api = useVario(schema, pageOptions)
    const session = getPageSessionForContext(unref(api.ctx))
    if (session) manager.register(id, session)
    pages.set(id, api)
    activeId.value = id
    return api
  }

  function pause(id: string): void {
    manager.pause(id)
  }

  function dispose(id: string): void {
    pages.get(id)?.dispose()
    manager.dispose(id)
    pages.delete(id)
    if (activeId.value === id) activeId.value = null
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      for (const id of [...pages.keys()]) dispose(id)
      manager.disposeAll()
    })
  }

  return { manager, activeId, open, pause, dispose }
}
