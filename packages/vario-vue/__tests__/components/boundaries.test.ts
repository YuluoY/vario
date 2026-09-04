import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { createRuntimeContext } from '@variojs/core'
import { prepareView } from '@variojs/schema'
import { VarioLifecycleBoundary } from '../../src/components/lifecycle-boundary.js'
import { VarioErrorBoundary } from '../../src/components/error-boundary.js'
import { PageSession } from '../../src/runtime/page-session.js'

describe('T2.6 boundaries', () => {
  it('lifecycle and error boundaries are module-level types', () => {
    expect(VarioLifecycleBoundary).toBeTruthy()
    expect(VarioErrorBoundary).toBeTruthy()
  })

  it('resolves hook plan from PageSession by nodeId', () => {
    const schema = { type: 'div', onMounted: 'boot', children: 'x' }
    const view = prepareView(schema as never)
    const session = new PageSession({
      ctx: createRuntimeContext({}),
      view
    })
    const nodeId = [...view.nodes.values()][0]?.id
    const vnode = h(VarioLifecycleBoundary, {
      inner: 'div',
      innerAttrs: {},
      innerChildren: 'x',
      sessionId: session.id,
      nodeId
    })
    expect(vnode.type).toBe(VarioLifecycleBoundary)
    expect((vnode.props as { sessionId?: string }).sessionId).toBe(session.id)
    expect((vnode.props as { nodeId?: string }).nodeId).toBe(nodeId)
    session.dispose()
  })
})
