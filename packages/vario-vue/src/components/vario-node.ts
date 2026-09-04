import { defineComponent } from 'vue'
import { resolvePageSession } from '../runtime/page-session.js'
import { renderPreparedNode } from '../runtime/prepared-renderer.js'
import { recordRuntimeMetric } from '../runtime/runtime-metrics.js'

export const VarioNode = defineComponent({
  name: 'VarioNode',
  props: {
    sessionId: { type: String, required: true },
    nodeId: { type: String, required: true }
  },
  setup(props: { sessionId: string; nodeId: string }) {
    return () => {
      const session = resolvePageSession(props.sessionId)
      if (!session?.view) return null
      try {
        recordRuntimeMetric({ name: 'render-node', sessionId: session.id, nodeId: props.nodeId }, session.sink)
        return renderPreparedNode(session, props.nodeId)
      } catch (error) {
        recordRuntimeMetric({ name: 'render-error', sessionId: session.id, nodeId: props.nodeId, engineId: session.runtime.engineId, pageId: session.id, schemaId: session.view.id, revision: session.view.revision }, session.sink)
        throw error
      }
    }
  }
})
