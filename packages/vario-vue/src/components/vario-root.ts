import { defineComponent, onUnmounted, onMounted, onUpdated, onActivated, onDeactivated, getCurrentInstance, h } from 'vue'
import { getPageSession, providePageSession } from '../runtime/page-session.js'
import { recordRuntimeMetric } from '../runtime/runtime-metrics.js'
import { VarioNode } from './vario-node.js'
import { VarioErrorBoundary } from './error-boundary.js'

export const VarioRoot = defineComponent({
  name: 'VarioRoot',
  props: {
    sessionId: { type: String, required: true },
    rootId: { type: String, required: true }
  },
  setup(props: { sessionId: string; rootId: string }) {
    const inst = getCurrentInstance()
    const provided = getPageSession(props.sessionId)
    if (provided) providePageSession(provided)
    onMounted(() => {
      const session = getPageSession(props.sessionId)
      if (session) recordRuntimeMetric({ name: 'render-mount', sessionId: session.id, nodeId: props.rootId }, session.sink)
    })
    onUpdated(() => {
      const session = getPageSession(props.sessionId)
      if (session) recordRuntimeMetric({ name: 'render-update', sessionId: session.id, nodeId: props.rootId }, session.sink)
    })
    onActivated(() => {
      getPageSession(props.sessionId)?.activate()
    })
    onDeactivated(() => {
      getPageSession(props.sessionId)?.deactivate()
    })
    onUnmounted(() => {
      if (inst) (inst as unknown as { subTree: unknown; parent: unknown; root: unknown }).subTree = null
      if (inst) {
        const rec = inst as unknown as Record<string, unknown>
        rec.parent = null
        rec.root = null
        queueMicrotask(() => {
          rec.job = null
          rec.update = null
          rec.effect = null
          rec.render = null
          rec.um = null
          rec.bum = null
        })
      }
    })
    return () => {
      const session = getPageSession(props.sessionId)
      if (!session?.view) return null
      const root = session.node(props.rootId) ?? (session.view.rootNodeId ? session.node(session.view.rootNodeId) : undefined)
      if (!root) return null
      recordRuntimeMetric({ name: 'render-root', sessionId: session.id, nodeId: root.id }, session.sink)
      return h(VarioErrorBoundary, {
        sessionId: props.sessionId,
        nodeId: root.id
      }, {
        default: () => h(VarioNode, { sessionId: props.sessionId, nodeId: root.id })
      })
    }
  }
})
