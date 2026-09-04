import type { RuntimeContext } from '@variojs/types'
import type { SchemaNode } from '@variojs/schema'
import { prepareView } from '@variojs/schema'
import { createSSRApp, type App } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { PageSession } from '../runtime/page-session.js'
import { VueRenderer } from '../renderer.js'
import { installRegionInterceptor } from '../runtime/prepared-renderer.js'
import { applySchemaModelDefaults } from '../bindings.js'

export type SsrRenderOptions = {
  components?: Record<string, unknown>
  directives?: Record<string, unknown>
  /** 隔离的 engine（capability/material 注册表）；缺省共享 'default'（T3.8/FR-14） */
  engineId?: string
}

export function createSsrSession(
  ctx: RuntimeContext,
  schema: SchemaNode,
  options: SsrRenderOptions = {}
): PageSession {
  applySchemaModelDefaults(schema, ctx)
  const view = prepareView(schema)
  const renderer = new VueRenderer({
    components: options.components as never,
    directives: options.directives as never
  })
  const session = new PageSession({ ctx, view, renderer, engineId: options.engineId })
  installRegionInterceptor(session)
  return session
}

export { createSsrSession as createSsrEngine }

export async function renderSsrToString(
  schema: SchemaNode,
  ctx: RuntimeContext,
  options: SsrRenderOptions = {}
): Promise<string> {
  const session = createSsrSession(ctx, schema, options)
  try {
    const vnode = session.renderer!.render(schema, ctx)
    const app = createSSRApp({
      setup() {
        return () => vnode
      }
    })
    return await renderToString(app)
  } finally {
    // T3.8：不 dispose 传入的 ctx（hydrate 复用同一 ctx）；只从全局表摘除
    session.detach()
  }
}

export async function hydrateVarioApp(
  container: { innerHTML: string },
  schema: SchemaNode,
  ctx: RuntimeContext
): Promise<{ app: App; session: PageSession }> {
  const html = await renderSsrToString(schema, ctx)
  container.innerHTML = html
  const session = createSsrSession(ctx, schema)
  session.activate()
  const vnode = session.renderer!.render(schema, ctx)
  const app = createSSRApp({
    setup() {
      return () => vnode
    }
  })
  app.mount(container as never)
  return { app, session }
}
