/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { VueRenderer } from '../../src/renderer'
import { createRuntimeContext, SchemaDepthError } from '@variojs/core'
import { generateScenario } from '../../../../benchmarks/vue-depth/fixtures.js'

function deepSchema(depth: number) {
  let node: { type: string; children?: unknown } = { type: 'span', children: 'leaf' }
  for (let i = 1; i < depth; i++) {
    node = { type: 'div', children: [node] }
  }
  return node
}

describe('T0.4 depth render', () => {
  const renderer = new VueRenderer()
  const ctx = createRuntimeContext({ label: 'x' })

  it.each([1, 20, 32, 50, 64, 100])('D=%s mounts', (d) => {
    const vnode = renderer.render(deepSchema(d) as never, ctx)
    expect(vnode).toBeTruthy()
  })

  it('D=101 throws SCHEMA_DEPTH_EXCEEDED with node/path/actual/limit before vnode', () => {
    try {
      renderer.render(deepSchema(101) as never, ctx)
      throw new Error('expected SchemaDepthError')
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaDepthError)
      const metadata = (error as SchemaDepthError).context.metadata
      expect(metadata?.node).toBeTruthy()
      expect(metadata?.path !== undefined).toBe(true)
      expect(metadata?.actual).toBeGreaterThan(100)
      expect(metadata?.limit).toBe(100)
    }
  })

  it('T0.1 deep fixture at D=20 renders', () => {
    const scene = generateScenario({ kind: 'deep', seed: 7, N: 1, D: 20, S: 1, R: 1, M: 1 })
    expect(renderer.render(scene.schema, ctx)).toBeTruthy()
  })

  it('AC-02 D=32 registered component fixture produces a vnode', async () => {
    const { defineComponent, h } = await import('vue')
    const Leaf = defineComponent({ name: 'Leaf', setup: () => () => h('span', 'leaf') })
    const custom = new VueRenderer({ components: { Leaf } })
    let node: { type: string; children?: unknown } = { type: 'Leaf' }
    for (let i = 1; i < 32; i++) node = { type: 'div', children: [node] }
    expect(custom.render(node as never, ctx)).toBeTruthy()
  })

  it.each([200, 500, 1000])('D=%s throws before vnode', (d) => {
    expect(() => renderer.render(deepSchema(d) as never, ctx)).toThrow(SchemaDepthError)
  })
})

describe('AC-02 native/forced-region/registered mount-update-unmount', () => {
  function chain(depth: number, leaf: Record<string, unknown>) {
    let node: Record<string, unknown> = leaf
    for (let i = 1; i < depth; i++) node = { type: 'div', children: [node] }
    return node
  }

  async function mountPrepared(schema: object, options: Record<string, unknown>) {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const { useVario, getRuntimeMode, setRuntimeMode } = await import('../../src/index.js')
    const previous = getRuntimeMode()
    setRuntimeMode('prepared')
    const host = document.createElement('div')
    document.body.appendChild(host)
    let api: ReturnType<typeof useVario>
    const app = createApp(defineComponent({
      setup() {
        api = useVario(schema as never, options as never)
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    return {
      host,
      api: api!,
      async update(label: string) {
        api.ctx.value._set('label', label)
        await nextTick()
      },
      unmount() {
        app.unmount()
        host.remove()
        setRuntimeMode(previous)
      }
    }
  }

  it.each([32, 64, 100] as const)('native D=%s deepest leaf updates then unmounts', async (d) => {
    const mounted = await mountPrepared(chain(d, { type: 'span', children: '{{ label }}' }), {
      state: { label: `n${d}` }
    })
    expect(mounted.host.textContent).toContain(`n${d}`)
    await mounted.update(`u${d}`)
    expect(mounted.host.textContent).toContain(`u${d}`)
    mounted.unmount()
    expect(mounted.host.isConnected).toBe(false)
  })

  it.each([32, 64, 100] as const)('forced-region D=%s deepest leaf updates then unmounts', async (d) => {
    const mounted = await mountPrepared(
      chain(d, { type: 'span', onMounted: 'noop', children: '{{ label }}' }),
      { state: { label: `f${d}` }, methods: { noop: () => {} } }
    )
    expect(mounted.host.textContent).toContain(`f${d}`)
    await mounted.update(`fu${d}`)
    expect(mounted.host.textContent).toContain(`fu${d}`)
    mounted.unmount()
  })

  it.each([32, 64, 100] as const)('registered component D=%s deepest leaf updates then unmounts', async (d) => {
    const { defineComponent, h } = await import('vue')
    const Leaf = defineComponent({
      name: 'Leaf',
      props: { label: { type: String, default: '' } },
      setup: (props: { label: string }) => () => h('span', props.label)
    })
    const mounted = await mountPrepared(
      chain(d, { type: 'Leaf', props: { label: '{{ label }}' } }),
      { state: { label: `c${d}` }, components: { Leaf } }
    )
    expect(mounted.host.textContent).toContain(`c${d}`)
    await mounted.update(`cu${d}`)
    expect(mounted.host.textContent).toContain(`cu${d}`)
    mounted.unmount()
  })
})
