import { describe, expect, it } from 'vitest'
import { CanvasWorkspace } from '../../src/canvas/workspace.js'
import { compileSchemaInWorker } from '../../src/canvas/compile-in-worker.js'
import { ErrorCodes } from '@variojs/core'

function canvasSchema() {
  return {
    type: 'App',
    id: 'root',
    children: [
      { type: 'Header', id: 'header', props: { title: 'H' } },
      { type: 'Body', id: 'body', props: { text: 'B' } },
      { type: 'Footer', id: 'footer', props: { text: 'F' } }
    ]
  }
}

describe('CANVAS workspace', () => {
  it('CANVAS-1 findById().patch() is not a no-op; readonly is typed', () => {
    const ws = new CanvasWorkspace(canvasSchema())
    ws.findById('header')?.patch({ props: { title: 'patched' } })
    expect((ws.findById('header')?.node.props as { title: string }).title).toBe('patched')
    const ro = new CanvasWorkspace(canvasSchema(), { readonly: true })
    try {
      ro.findById('header')?.patch({ props: { title: 'x' } })
      expect.fail('readonly patch should throw')
    } catch (error) {
      expect((error as { code: string }).code).toBe(ErrorCodes.SCHEMA_READONLY)
    }
  })

  it('CANVAS-2 patch only recompiles the affected subtree', () => {
    const ws = new CanvasWorkspace(canvasSchema())
    const bodyBefore = ws.node('body')
    ws.patch('header', { props: { title: 'H2' } })
    expect(ws.lastRecompiledIds).toContain('header')
    expect(ws.lastRecompiledIds).not.toContain('footer')
    expect(ws.node('body')).toBe(bodyBefore)
  })

  it('emits schema-load and schema-patch', () => {
    const names: string[] = []
    const ws = new CanvasWorkspace(canvasSchema(), {
      diagnosticSink: { emit(event) { names.push(event.name) } }
    })
    ws.patch('header', { props: { title: 'H3' } })
    expect(names).toContain('schema-load')
    expect(names).toContain('schema-patch')
  })

  it('CANVAS-3 undo/redo 1000 times keeps document and PreparedView ids aligned', () => {
    const ws = new CanvasWorkspace(canvasSchema())
    for (let i = 0; i < 1000; i++) {
      ws.patch('body', { props: { text: `t-${i}` } })
    }
    for (let i = 0; i < 1000; i++) ws.undo()
    expect((ws.findById('body')?.node.props as { text: string }).text).toBe('B')
    for (let i = 0; i < 1000; i++) ws.redo()
    expect((ws.findById('body')?.node.props as { text: string }).text).toBe('t-999')
    expect([...ws.view.nodes.keys()].sort()).toEqual(
      ['body', 'footer', 'header', 'root'].sort()
    )
    expect(ws.view.revision).toBe(ws.revision)
  })

  it('CANVAS-5 reorder keeps stable node ids', () => {
    const ws = new CanvasWorkspace(canvasSchema())
    const idsBefore = [...ws.view.nodes.keys()].sort()
    const moved = ws.reorder('root', 0, 2)
    expect(moved.movedId).toBe('header')
    expect([...ws.view.nodes.keys()].sort()).toEqual(idsBefore)
    expect(ws.node('header')?.id).toBe('header')
  })

  it('applyRemote rejects conflicting before snapshots', () => {
    const ws = new CanvasWorkspace(canvasSchema())
    expect(() => ws.applyRemote({
      id: 'header',
      path: 'header',
      before: { type: 'Header', props: { title: 'stale' } },
      after: { props: { title: 'x' } },
      affectedIds: ['header'],
      revision: 1
    })).toThrow(/Patch conflict/)
  })

  it('CANVAS-4 5000-node compile/validate runs in a Worker with main-thread busy <50ms', async () => {
    const children = Array.from({ length: 4999 }, (_, i) => ({ type: 'span', id: `n-${i}`, children: `x-${i}` }))
    const schema = { type: 'div', id: 'wide', children }
    const result = await compileSchemaInWorker(schema as never)
    expect(result.nodeCount).toBeGreaterThanOrEqual(5000)
    expect(result.mainThreadBusyMs).toBeLessThan(50)
    expect(result.workerMs).toBeGreaterThan(0)
  })

  it('PERF-D3 60 library patches p95 ≤8ms', () => {
    const ws = new CanvasWorkspace(canvasSchema())
    const times: number[] = []
    for (let i = 0; i < 60; i++) {
      const t0 = performance.now()
      ws.patch('header', { props: { title: `drag-${i}` } })
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    expect(times[Math.min(times.length - 1, Math.floor(times.length * 0.95))]).toBeLessThanOrEqual(8)
  })
})
