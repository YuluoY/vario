import { describe, expect, it } from 'vitest'
import { CanvasWorkspace } from '@variojs/schema'

describe('browser canvas-patch', () => {
  it('CANVAS-1 findById().patch() is not a no-op', () => {
    const ws = new CanvasWorkspace({
      type: 'div',
      id: 'root',
      children: [{ type: 'span', id: 'title', props: { title: 'H' } }]
    })
    ws.findById('title')?.patch({ props: { title: 'patched' } })
    expect((ws.findById('title')?.node.props as { title: string }).title).toBe('patched')
  })
})
