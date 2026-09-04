import { defineComponent, h, Fragment } from 'vue'
import { resolvePageSession } from '../runtime/page-session.js'

export const SlotRegion = defineComponent({
  name: 'VarioSlotRegion',
  props: {
    sessionId: { type: String, required: true },
    regionId: { type: String, required: true }
  },
  setup(props: { sessionId: string; regionId: string }) {
    return () => {
      const session = resolvePageSession(props.sessionId)
      if (!session?.renderer || !session.ctx) return null
      const node = session.node(props.regionId)
      if (!node) return null
      const ctx = session.currentLexical() ?? session.ctx
      const plan = session.view?.slots.get(node.id)
      const bindings: Record<string, unknown> = {}
      if (plan) {
        for (const name of plan.propNames) {
          try {
            bindings[name] = ctx._get(name)
          } catch (error) {
            if (error instanceof RangeError) throw error
            bindings[name] = undefined
          }
        }
      }
      if (plan) session.pushScope(bindings)
      session.pushRendering(node.id)
      try {
        const childIds = plan?.fallbackIds.length ? plan.fallbackIds : node.childIds
        if (childIds.length > 0) {
          const children = childIds.map(id => {
            const schema = session.source(id)
            return schema ? session.renderer!.renderNode(schema, ctx) : null
          }).filter(Boolean)
          return h(Fragment, null, children)
        }
        const schema = session.source(node.id)
        if (!schema) return null
        return session.renderer.renderNode(schema, ctx)
      } finally {
        session.popRendering(node.id)
        if (plan) session.popScope()
      }
    }
  }
})
