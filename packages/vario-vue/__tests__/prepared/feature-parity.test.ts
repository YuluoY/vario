/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, type Directive } from 'vue'
import { VueRenderer } from '../../src/renderer.js'
import { createRuntimeContext } from '@variojs/core'
import { applyVnodePipeline } from '../../src/runtime/vnode-pipeline.js'
import { useVario, getRuntimeMode, setRuntimeMode } from '../../src/index.js'

describe('T2.7 feature parity pipeline', () => {
  it('legacy renderer still produces vnodes for directive/event/model fixtures', () => {
    const ctx = createRuntimeContext({ label: 'ok', value: 'v' })
    const renderer = new VueRenderer()
    const vnode = renderer.render({
      type: 'div',
      props: { title: '{{ label }}' },
      events: { click: 'onClick' },
      children: [{ type: 'input', model: 'value' }]
    }, ctx)
    expect(vnode).toBeTruthy()
    expect(typeof applyVnodePipeline).toBe('function')
  })
})

async function mountMode(
  mode: 'legacy' | 'prepared',
  schema: object,
  options: Record<string, unknown>
) {
  const previous = getRuntimeMode()
  setRuntimeMode(mode)
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
    unmount() {
      app.unmount()
      host.remove()
      setRuntimeMode(previous)
    }
  }
}

describe('AC-15 legacy/prepared feature fixtures', () => {
  it('model/event/ref/slot/teleport/transition/keepAlive/directive text and attrs match', async () => {
    const clicks: Record<string, number> = { legacy: 0, prepared: 0 }
    const highlight: Directive = {
      mounted(el) {
        (el as HTMLElement).setAttribute('data-dir', 'on')
      }
    }
    const Panel = defineComponent({
      name: 'Panel',
      setup(_, { slots }) {
        return () => h('div', { class: 'panel' }, [
          h('header', slots.header?.()),
          h('main', slots.default?.())
        ])
      }
    })
    const schema = {
      type: 'div',
      children: [
        { type: 'span', ref: 'labelRef', children: '{{ label }}' },
        { type: 'button', events: { click: 'ping' }, children: 'go' },
        { type: 'input', model: 'value' },
        {
          type: 'Panel',
          children: [
            { type: 'template', slot: 'header', children: [{ type: 'span', children: 'H' }] },
            { type: 'span', children: 'body' }
          ]
        },
        { type: 'div', transition: 'fade', children: 'tr' },
        { type: 'div', keepAlive: true, children: 'ka' },
        { type: 'span', directives: [{ name: 'highlight', value: true }], children: 'dir' }
      ]
    }
    const optionsFor = (mode: 'legacy' | 'prepared') => ({
      state: { label: 'Ada', value: 'v1' },
      components: { Panel },
      directives: { highlight },
      methods: { ping: () => { clicks[mode] += 1 } }
    })
    const legacy = await mountMode('legacy', schema, optionsFor('legacy'))
    const prepared = await mountMode('prepared', schema, optionsFor('prepared'))
    expect(legacy.host.textContent).toContain('Ada')
    expect(prepared.host.textContent).toContain('Ada')
    expect(legacy.host.textContent).toContain('H')
    expect(prepared.host.textContent).toContain('H')
    expect(legacy.host.textContent).toContain('body')
    expect(prepared.host.textContent).toContain('body')
    expect(legacy.host.textContent).toContain('tr')
    expect(prepared.host.textContent).toContain('tr')
    expect(legacy.host.textContent).toContain('ka')
    expect(prepared.host.textContent).toContain('ka')
    expect(legacy.host.querySelector('[data-dir="on"]')).toBeTruthy()
    expect(prepared.host.querySelector('[data-dir="on"]')).toBeTruthy()
    ;(legacy.host.querySelector('button') as HTMLButtonElement).click()
    ;(prepared.host.querySelector('button') as HTMLButtonElement).click()
    await nextTick()
    expect(clicks.legacy).toBe(1)
    expect(clicks.prepared).toBe(1)
    expect(legacy.api.refs.labelRef).toBeDefined()
    expect(prepared.api.refs.labelRef).toBeDefined()
    const portal = document.createElement('div')
    portal.id = 'ac15-portal'
    document.body.appendChild(portal)
    const teleportSchema = { type: 'div', teleport: '#ac15-portal', children: 'ported' }
    const tLegacy = await mountMode('legacy', teleportSchema, { state: {} })
    const tPrepared = await mountMode('prepared', teleportSchema, { state: {} })
    expect(portal.textContent).toContain('ported')
    tLegacy.unmount()
    tPrepared.unmount()
    portal.remove()
    legacy.unmount()
    prepared.unmount()
  })

  it('provide/inject fixture mounts in both modes', async () => {
    const schema = {
      type: 'div',
      provide: { theme: 'dark' },
      onMounted: 'noop',
      children: [{ type: 'span', inject: ['theme'], onMounted: 'noop', children: 'kid' }]
    }
    const options = { state: {}, methods: { noop: () => {} } }
    const legacy = await mountMode('legacy', schema, options)
    const prepared = await mountMode('prepared', schema, options)
    expect(legacy.host.textContent).toContain('kid')
    expect(prepared.host.textContent).toContain('kid')
    legacy.unmount()
    prepared.unmount()
  })

  it('T3.9 hook sequences and expression slot/ref parity match across modes', async () => {
    const hooks: Record<'legacy' | 'prepared', string[]> = { legacy: [], prepared: [] }
    const EchoPanel = defineComponent({
      name: 'EchoPanel',
      setup(_, { slots }) {
        return () => h('div', { class: 'echo' }, slots.default?.())
      }
    })
    const schema = {
      type: 'div',
      onMounted: 'rootMounted',
      onUnmounted: 'rootUnmounted',
      children: [
        { type: 'span', ref: 'nameRef', children: '{{ user.name }}' },
        {
          type: 'EchoPanel',
          children: [{ type: 'template', slot: 'default', children: [{ type: 'b', children: '{{ user.name }}' }] }]
        },
        { type: 'em', onMounted: 'childMounted', children: '{{ user.name }}' }
      ]
    }
    const optionsFor = (mode: 'legacy' | 'prepared') => ({
      state: { user: { name: 'Ada' } },
      components: { EchoPanel },
      methods: {
        rootMounted: () => { hooks[mode].push('root:mounted') },
        rootUnmounted: () => { hooks[mode].push('root:unmounted') },
        childMounted: () => { hooks[mode].push('child:mounted') }
      }
    })
    const legacy = await mountMode('legacy', schema, optionsFor('legacy'))
    const prepared = await mountMode('prepared', schema, optionsFor('prepared'))
    // 相同 DOM 语义：文本一致、插槽表达式内容一致
    expect(legacy.host.textContent).toBe(prepared.host.textContent)
    expect(legacy.host.textContent).toContain('Ada')
    expect(prepared.host.querySelector('.echo b')?.textContent).toBe('Ada')
    // ref 指向表达式驱动的节点
    const legacyRef = legacy.api.refs.nameRef
    const preparedRef = prepared.api.refs.nameRef
    expect((legacyRef as unknown as { value?: HTMLElement }).value?.textContent ?? (legacyRef as HTMLElement)?.textContent).toBe('Ada')
    expect((preparedRef as unknown as { value?: HTMLElement }).value?.textContent ?? (preparedRef as HTMLElement)?.textContent).toBe('Ada')
    // 挂载期 hook 序列一致
    expect(hooks.prepared).toEqual(hooks.legacy)
    expect(hooks.legacy).toContain('root:mounted')
    expect(hooks.legacy).toContain('child:mounted')
    // 表达式数据变更在两种模式下同步刷新
    legacy.api.ctx.value._set('user.name', 'Bob')
    prepared.api.ctx.value._set('user.name', 'Bob')
    await nextTick()
    expect(legacy.host.textContent).toBe(prepared.host.textContent)
    expect(prepared.host.textContent).toContain('Bob')
    legacy.unmount()
    prepared.unmount()
    expect(hooks.prepared).toEqual(hooks.legacy)
    expect(hooks.legacy[hooks.legacy.length - 1]).toBe('root:unmounted')
  })
})
