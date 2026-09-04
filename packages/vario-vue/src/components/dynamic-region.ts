import { defineComponent, h } from 'vue'
import { evaluateExpressionPlan } from '@variojs/core'
import type { PreparedNode, RuntimeContext } from '@variojs/types'
import type { SchemaNode } from '@variojs/schema'
import { resolvePageSession, type PageSession } from '../runtime/page-session.js'
import { emitPerformance } from '../internal/performance-hooks.js'
import { isNativeDOMElement } from '../features/component-resolver.js'

function renderFastNative(schema: SchemaNode, ctx: RuntimeContext, session?: PageSession, node?: PreparedNode) {
  if (!isNativeDOMElement(schema.type)) return null
  const rec = schema as SchemaNode & Record<string, unknown>
  if (
    schema.props ||
    schema.events ||
    schema.model ||
    schema.cond ||
    schema.show ||
    schema.directives ||
    schema.loop ||
    schema.ref ||
    rec.onMounted ||
    rec.onUnmounted ||
    rec.onUpdated ||
    rec.onBeforeMount ||
    rec.onBeforeUnmount ||
    rec.onBeforeUpdate ||
    rec.onActivated ||
    rec.onDeactivated ||
    rec.provide ||
    rec.inject ||
    rec.teleport ||
    rec.transition ||
    rec.keepAlive
  ) {
    return null
  }
  const children = schema.children
  if (typeof children === 'string') {
    if (children.includes('{{')) {
      const plan = node?.textPlan?.planId ? session?.view?.expressions.get(node.textPlan.planId) : undefined
      if (!plan || !session) return null
      const value = evaluateExpressionPlan(plan, ctx, {
        memo: session.memo,
        frame: session.currentFrame(),
        table: session.frames
      })
      return h(schema.type, null, value == null ? '' : String(value))
    }
    return h(schema.type, null, children)
  }
  if (children == null) return h(schema.type)
  return null
}

export const StaticRegion = defineComponent({
  name: 'VarioStaticRegion',
  props: {
    sessionId: { type: String, required: true },
    regionId: { type: String, required: true }
  },
  setup(props: { sessionId: string; regionId: string }) {
    return () => {
      const session = resolvePageSession(props.sessionId)
      if (!session?.renderer || !session.view || !session.ctx) return null
      const node = session.node(props.regionId)
      if (!node) return null
      const schema = session.source(node.id)
      if (!schema) return null
      session.pushRendering(node.id)
      try {
        return session.renderer.renderNode(schema, session.ctx)
      } finally {
        session.popRendering(node.id)
      }
    }
  }
})

export const DynamicRegion = defineComponent({
  name: 'VarioDynamicRegion',
  props: {
    sessionId: { type: String, required: true },
    regionId: { type: String, required: true }
  },
  setup(props: { sessionId: string; regionId: string }) {
    return () => {
      const session = resolvePageSession(props.sessionId)
      if (!session?.renderer || !session.view || !session.bridge || !session.ctx) return null
      void session.bridge.tokenFor(props.regionId).value
      emitPerformance('regionRender')
      const node = session.node(props.regionId)
      if (!node) return null
      const schema = session.source(node.id)
      if (!schema) return null
      session.pushRendering(node.id)
      try {
        return renderFastNative(schema, session.ctx, session, node)
          ?? session.renderer.renderNode(schema, session.ctx)
      } finally {
        session.popRendering(node.id)
      }
    }
  }
})
