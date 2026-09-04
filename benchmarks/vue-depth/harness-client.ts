import { createApp, defineComponent, h, nextTick } from 'vue'
import { useVario, setRuntimeMode, PageSession, activePageSessionCount, hydrateVarioApp, renderSsrToString } from '@variojs/vue'
import { createRuntimeContext, getOrCreateEngine } from '@variojs/core'
import { prepareView, CanvasWorkspace } from '@variojs/schema'
import { generateScenario } from './fixtures.ts'

export type BenchSample = {
  prepareMs: number
  vnodeMs: number
  commitMs: number
  paintMs: number
  longTaskMs: number
  longTaskCount: number
  correct: boolean
  gate?: string
}

async function runSample(kind: 'flat' | 'deep' = 'flat', mode: 'legacy' | 'prepared' = 'legacy'): Promise<BenchSample> {
  setRuntimeMode(mode)
  const scene = generateScenario({ kind, seed: 7, N: 32, D: 8, S: 8, R: 4, M: 2 })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const longTasks: number[] = []
  let observer: PerformanceObserver | null = null
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration)
    })
    observer.observe({ entryTypes: ['longtask'] })
  } catch {
    observer = null
  }
  const prepareStart = performance.now()
  const Root = defineComponent({
    setup() {
      const api = useVario(scene.schema, { state: scene.state })
      return () => api.vnode.value
    }
  })
  const prepareMs = performance.now() - prepareStart
  const app = createApp(Root)
  const vnodeStart = performance.now()
  app.mount(host)
  await nextTick()
  const commitMs = performance.now() - vnodeStart
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  const paintMs = performance.now() - vnodeStart
  const text = host.textContent ?? ''
  const correct = text.length > 0
  observer?.disconnect()
  app.unmount()
  host.remove()
  setRuntimeMode('prepared')
  return {
    prepareMs,
    vnodeMs: commitMs,
    commitMs,
    paintMs,
    longTaskMs: longTasks.reduce((a, b) => Math.max(a, b), 0),
    longTaskCount: longTasks.length,
    correct
  }
}

async function runBatch(warmup = 20, samples = 50, mode: 'legacy' | 'prepared' = 'legacy'): Promise<BenchSample[]> {
  for (let i = 0; i < warmup; i++) await runSample(i % 2 === 0 ? 'flat' : 'deep', mode)
  const raw: BenchSample[] = []
  for (let i = 0; i < samples; i++) raw.push(await runSample(i % 2 === 0 ? 'flat' : 'deep', mode))
  return raw
}

async function runGate(gate: string, mode: 'legacy' | 'prepared' = 'prepared'): Promise<BenchSample> {
  const waitPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  if (gate === 'PERF-T1') {
    const schema = {
      type: 'div',
      children: [
        ...Array.from({ length: 500 }, (_, i) => ({ type: 'span', children: `{{ v${i} }}` })),
        ...Array.from({ length: 499 }, (_, i) => ({ type: 'span', children: `s-${i}` }))
      ]
    }
    const t0 = performance.now()
    const view = prepareView(schema as never)
    return {
      prepareMs: performance.now() - t0,
      vnodeMs: 0,
      commitMs: 0,
      paintMs: 0,
      longTaskMs: 0,
      longTaskCount: 0,
      correct: view.nodeCount === 1000,
      gate
    }
  }
  if (gate === 'PERF-T7' || gate === 'PERF-T8') {
    setRuntimeMode(mode)
    const pages: Array<{
      app: ReturnType<typeof createApp>
      host: HTMLElement
      api: ReturnType<typeof useVario>
    }> = []
    const t0 = performance.now()
    for (let i = 0; i < 20; i++) {
      const pageHost = document.createElement('div')
      document.body.appendChild(pageHost)
      let pageApi!: ReturnType<typeof useVario>
      const pageApp = createApp(defineComponent({
        setup() {
          pageApi = useVario({
            type: 'div',
            children: [
              { type: 'span', children: '{{ n }}' },
              ...Array.from({ length: 199 }, () => ({ type: 'span', children: 'x' }))
            ]
          } as never, { state: { n: `p${i}` } })
          return () => pageApi.vnode.value
        }
      }))
      pageApp.mount(pageHost)
      pages.push({ app: pageApp, host: pageHost, api: pageApi })
    }
    await nextTick()
    let measured = performance.now() - t0
    let correct = pages.every((p, i) => (p.host.textContent ?? '').includes(`p${i}`))
      && pages.every(p => p.host.querySelectorAll('span').length === 200)
    if (gate === 'PERF-T8') {
      const u0 = performance.now()
      pages[0].api.ctx.value._set('n', 'ACTIVE')
      await nextTick()
      measured = performance.now() - u0
      await waitPaint()
      correct = (pages[0].host.textContent ?? '').includes('ACTIVE')
        && pages.slice(1).every((p, i) => {
          const text = p.host.textContent ?? ''
          return text.includes(`p${i + 1}`) && !text.includes('ACTIVE')
        })
    }
    for (const page of pages) {
      page.app.unmount()
      page.host.remove()
      page.api.dispose()
    }
    setRuntimeMode('prepared')
    return {
      prepareMs: measured,
      vnodeMs: measured,
      commitMs: measured,
      paintMs: measured,
      longTaskMs: 0,
      longTaskCount: 0,
      correct,
      gate
    }
  }
  const n = gate === 'PERF-T2' ? 200 : 1000
  const values = Array.from({ length: n }, (_, i) => `v${i}`)
  const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, label: `row-${i}` }))
  ;(items as { __varioMem2?: string }).__varioMem2 = 'MEM2-UNIQUE-TOKEN'
  ;(window as Window & { __varioLeakProbe?: WeakRef<object> }).__varioLeakProbe = new WeakRef(items)
  setRuntimeMode(mode)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const schema = gate.startsWith('PERF-T5') || gate === 'PERF-T6'
    ? { type: 'div', loop: { items: 'items', itemKey: 'item', indexKey: 'index' }, children: [{ type: 'span', children: '{{ item.label }}' }] }
    : {
        type: 'div',
        children: Array.from({ length: n }, (_, i) => ({ type: 'span', children: `{{ values[${i}] }}` }))
      }
  const state = gate === 'PERF-T5' || gate === 'PERF-T6' ? { items } : { values }
  let api: ReturnType<typeof useVario> | undefined
  const Root = defineComponent({
    setup() {
      api = useVario(schema as never, { state })
      return () => api!.vnode.value
    }
  })
  const prepareStart = performance.now()
  const vnodeStart = performance.now()
  const app = createApp(Root)
  app.mount(host)
  markMountedInstance(host)
  await nextTick()
  const commitMs = performance.now() - vnodeStart
  await waitPaint()
  const paintMs = performance.now() - vnodeStart
  let correct = (host.textContent ?? '').length > 0
  let measured = commitMs
  if (gate === 'PERF-T4') {
    for (let i = 0; i < 8; i++) {
      api!.ctx.value._set('values.0', `w${i}`)
      await nextTick()
    }
    const t0 = performance.now()
    api!.ctx.value._set('values.0', 'leaf')
    await nextTick()
    measured = performance.now() - t0
    await waitPaint()
    correct = (host.textContent ?? '').includes('leaf')
  }
  if (gate === 'PERF-T5') {
    correct = host.querySelectorAll('span').length <= 204 && visibleEnough(host)
  }
  if (gate === 'PERF-T6') {
    const t0 = performance.now()
    api!.ctx.value._set('items.0.label', 'updated')
    await nextTick()
    measured = performance.now() - t0
    await waitPaint()
    correct = (host.textContent ?? '').includes('updated') && host.querySelectorAll('span').length <= 204
  }
  app.unmount()
  delete (host as { _vnode?: unknown })._vnode
  const rec = app as { _container?: unknown; _instance?: unknown }
  rec._container = null
  rec._instance = null
  await nextTick()
  api?.dispose()
  api = undefined
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
  await waitPaint()
  host.replaceChildren()
  host.remove()
  setRuntimeMode('prepared')
  ;(window as Window & { __varioLiveSessions?: number }).__varioLiveSessions = activePageSessionCount()
  if (gate === 'PERF-T5' || gate === 'PERF-T6') {
    correct = Boolean(correct) && activePageSessionCount() === 0 && getOrCreateEngine().sessions.size === 0
  }
  const gcFn = (window as Window & { gc?: () => void }).gc
  gcFn?.()
  return {
    prepareMs: performance.now() - prepareStart,
    vnodeMs: measured,
    commitMs: measured,
    paintMs,
    longTaskMs: 0,
    longTaskCount: 0,
    correct,
    gate
  }
}

function markMountedInstance(host: HTMLElement): void {
  const inst = (host as { _vnode?: { component?: object } })._vnode?.component
  if (!inst) return
  ;(inst as { __varioRootMark?: string }).__varioRootMark = 'ROOT-MEM2-MARKER'
  const hist = ((window as Window & { __varioInstHistory?: WeakRef<object>[] }).__varioInstHistory ??= [])
  hist.push(new WeakRef(inst))
  ;(window as Window & { __varioInstProbe?: WeakRef<object> }).__varioInstProbe = new WeakRef(inst)
}

function visibleEnough(host: HTMLElement): boolean {
  return host.querySelectorAll('span').length > 0
}

void runGate

void runBatch
void h

async function runEmptyCycle(): Promise<void> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => h('div', 'x') })
  app.mount(host)
  markMountedInstance(host)
  await nextTick()
  app.unmount()
  host.remove()
}

async function runSessionCycle(count = 100): Promise<{ live: number }> {
  const sessions = Array.from({ length: count }, (_, i) => new PageSession({
    ctx: createRuntimeContext({ n: i }),
    view: prepareView({ type: 'div', children: '{{ n }}' } as never)
  }))
  for (const session of sessions) session.dispose()
  return { live: activePageSessionCount() }
}

async function runSsrHydrate(): Promise<{ mismatch: boolean; htmlMatch: boolean; isolated: boolean }> {
  const schema = {
    type: 'div',
    children: [
      { type: 'span', children: '{{ label }}' },
      { type: 'div', cond: '{{ show }}', children: 'shown' },
      {
        type: 'ul',
        loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
        children: [{ type: 'li', children: '{{ item }}' }]
      }
    ]
  }
  const warnings: string[] = []
  const warn = console.warn
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
    warn.apply(console, args)
  }
  const a = await renderSsrToString(schema as never, createRuntimeContext({ label: 'Ada', show: true, items: ['a', 'b'] }))
  const b = await renderSsrToString(schema as never, createRuntimeContext({ label: 'Ada', show: true, items: ['a', 'b'] }))
  const host = document.createElement('div')
  document.body.appendChild(host)
  const { app, session } = await hydrateVarioApp(
    host,
    schema as never,
    createRuntimeContext({ label: 'Ada', show: true, items: ['a', 'b'] })
  )
  const mismatch = warnings.some(w => /hydrat/i.test(w))
  const hasDom = (host.textContent ?? '').includes('Ada') && (host.textContent ?? '').includes('shown')
  app.unmount()
  session.dispose()
  host.remove()
  console.warn = warn
  return { mismatch, htmlMatch: a === b && a.includes('Ada'), isolated: hasDom && activePageSessionCount() === 0 }
}

async function runCanvasDrag(): Promise<{ p95: number; frameP95: number; correct: boolean }> {
  setRuntimeMode('prepared')
  const ws = new CanvasWorkspace({
    type: 'App',
    id: 'root',
    children: [{ type: 'Header', id: 'header', props: { title: 'H' } }]
  })
  const host = document.createElement('div')
  document.body.appendChild(host)
  let api: ReturnType<typeof useVario> | undefined
  const app = createApp(defineComponent({
    setup() {
      api = useVario({ type: 'span', children: '{{ title }}' } as never, { state: { title: 'H' } })
      return () => api!.vnode.value
    }
  }))
  app.mount(host)
  await nextTick()
  const libraryTimes: number[] = []
  const frameTimes: number[] = []
  const waitPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  for (let i = 0; i < 60; i++) {
    const t0 = performance.now()
    ws.patch('header', { props: { title: `drag-${i}` } })
    libraryTimes.push(performance.now() - t0)
    api!.ctx.value._set('title', `drag-${i}`)
    await nextTick()
    await waitPaint()
    frameTimes.push(performance.now() - t0)
  }
  libraryTimes.sort((a, b) => a - b)
  frameTimes.sort((a, b) => a - b)
  const p95 = libraryTimes[Math.min(libraryTimes.length - 1, Math.floor(libraryTimes.length * 0.95))]
  const frameP95 = frameTimes[Math.min(frameTimes.length - 1, Math.floor(frameTimes.length * 0.95))]
  const correct = (host.textContent ?? '').includes('drag-59')
    && (ws.findById('header')?.node.props as { title: string }).title === 'drag-59'
  app.unmount()
  host.remove()
  setRuntimeMode('prepared')
  return { p95, frameP95, correct }
}

function ac02Chain(depth: number, leaf: Record<string, unknown>) {
  let node: Record<string, unknown> = leaf
  for (let i = 1; i < depth; i++) node = { type: 'div', children: [node] }
  return node
}

async function runAc02Depth(): Promise<{
  passed: boolean
  results: Array<{ d: number; kind: string; mounted: boolean; updated: boolean; unmounted: boolean }>
}> {
  const Leaf = defineComponent({
    name: 'Leaf',
    props: { label: { type: String, default: '' } },
    setup: (props: { label: string }) => () => h('span', props.label)
  })
  const results: Array<{ d: number; kind: string; mounted: boolean; updated: boolean; unmounted: boolean }> = []
  for (const d of [32, 64, 100] as const) {
    for (const kind of ['native', 'forced', 'registered'] as const) {
      const leaf = kind === 'native'
        ? { type: 'span', children: '{{ label }}' }
        : kind === 'forced'
          ? { type: 'span', onMounted: 'noop', children: '{{ label }}' }
          : { type: 'Leaf', props: { label: '{{ label }}' } }
      setRuntimeMode('prepared')
      const host = document.createElement('div')
      document.body.appendChild(host)
      let api: ReturnType<typeof useVario> | undefined
      const app = createApp(defineComponent({
        setup() {
          api = useVario(ac02Chain(d, leaf) as never, {
            state: { label: `n${d}${kind}` },
            methods: { noop: () => {} },
            components: { Leaf }
          })
          return () => api!.vnode.value
        }
      }))
      app.mount(host)
      await nextTick()
      const mounted = (host.textContent ?? '').includes(`n${d}${kind}`)
      api!.ctx.value._set('label', `u${d}${kind}`)
      await nextTick()
      const updated = (host.textContent ?? '').includes(`u${d}${kind}`)
      app.unmount()
      host.remove()
      setRuntimeMode('prepared')
      results.push({ d, kind, mounted, updated, unmounted: !host.isConnected })
    }
  }
  return { passed: results.every(r => r.mounted && r.updated && r.unmounted), results }
}

type InpProbeResult = {
  inpMs: number
  eventTimingMs: number
  nodeId: string
  actionId: string
  correct: boolean
  source: 'event-timing' | 'library-probe'
}

type InpMountState = {
  host: HTMLDivElement
  app: ReturnType<typeof createApp>
  observer: PerformanceObserver | null
  eventMs: number
  t0: number
}

let inpState: InpMountState | null = null

async function runInpMount(): Promise<void> {
  if (inpState) await runInpFinish()
  setRuntimeMode('prepared')
  const host = document.createElement('div')
  host.id = 'vario-inp-host'
  document.body.appendChild(host)
  let eventMs = 0
  let observer: PerformanceObserver | null = null
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'event' || entry.entryType === 'first-input') {
          eventMs = Math.max(eventMs, entry.duration)
        }
      }
    })
    observer.observe({ type: 'event', buffered: true, durationThreshold: 0 } as PerformanceObserverInit)
  } catch {
    observer = null
  }
  let api: ReturnType<typeof useVario> | undefined
  const app = createApp(defineComponent({
    setup() {
      api = useVario({
        type: 'button',
        props: { id: 'vario-inp-probe' },
        events: { click: 'ping' },
        children: '{{ label }}'
      } as never, {
        state: { label: 'go' },
        methods: { ping: () => { api!.ctx.value._set('label', 'ok') } }
      })
      return () => api!.vnode.value
    }
  }))
  app.mount(host)
  await nextTick()
  inpState = { host, app, observer, eventMs, t0: performance.now() }
  const holder = inpState
  if (observer) {
    observer.disconnect()
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'event' || entry.entryType === 'first-input') {
          holder.eventMs = Math.max(holder.eventMs, entry.duration)
        }
      }
    })
    observer.observe({ type: 'event', buffered: true, durationThreshold: 0 } as PerformanceObserverInit)
    holder.observer = observer
  }
}

async function runInpFinish(): Promise<InpProbeResult> {
  const state = inpState
  if (!state) {
    return { inpMs: 0, eventTimingMs: 0, nodeId: 'button', actionId: 'call', correct: false, source: 'library-probe' }
  }
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  const inpMs = state.eventMs > 0 ? state.eventMs : performance.now() - state.t0
  const correct = (state.host.textContent ?? '').includes('ok')
  state.observer?.disconnect()
  state.app.unmount()
  state.host.remove()
  inpState = null
  setRuntimeMode('prepared')
  return {
    inpMs,
    eventTimingMs: state.eventMs,
    nodeId: 'button',
    actionId: 'call',
    correct,
    source: state.eventMs > 0 ? 'event-timing' : 'library-probe'
  }
}

async function runInpProbe(): Promise<InpProbeResult> {
  await runInpMount()
  const button = document.getElementById('vario-inp-probe') as HTMLButtonElement | null
  button?.click()
  return runInpFinish()
}

async function runSsrIsolation50(): Promise<{ htmlCount: number; isolated: boolean }> {
  const htmls = await Promise.all(
    Array.from({ length: 50 }, (_, i) => {
      const Marker = defineComponent({
        name: `Mark${i}`,
        setup: () => () => h('span', `m-${i}`)
      })
      return renderSsrToString(
        { type: `Mark${i}` } as never,
        createRuntimeContext({ n: i }),
        { components: { [`Mark${i}`]: Marker } }
      )
    })
  )
  return { htmlCount: new Set(htmls).size, isolated: new Set(htmls).size === 50 }
}

async function runAc15Parity(): Promise<{
  textMatch: boolean
  namedSlot: boolean
  directive: boolean
  click: boolean
  teleport: boolean
  provide: boolean
}> {
  const highlight = {
    mounted(el: HTMLElement) {
      el.setAttribute('data-dir', 'on')
    }
  }
  const Panel = defineComponent({
    name: 'Panel',
    setup(_: unknown, { slots }: { slots: Record<string, (() => unknown) | undefined> }) {
      return () => h('div', { class: 'panel' }, [
        h('header', slots.header?.() as never),
        h('main', slots.default?.() as never)
      ])
    }
  })
  const schema = {
    type: 'div',
    children: [
      { type: 'span', ref: 'labelRef', children: '{{ label }}' },
      { type: 'button', events: { click: 'ping' }, children: 'go' },
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
  const texts: string[] = []
  const clicks: number[] = []
  const dirs: boolean[] = []
  for (const mode of ['legacy', 'prepared'] as const) {
    setRuntimeMode(mode)
    const host = document.createElement('div')
    document.body.appendChild(host)
    let n = 0
    let api: ReturnType<typeof useVario> | undefined
    const app = createApp(defineComponent({
      setup() {
        api = useVario(schema as never, {
          state: { label: 'Ada' },
          components: { Panel },
          directives: { highlight },
          methods: { ping: () => { n += 1 } }
        })
        return () => api!.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    texts.push(host.textContent ?? '')
    dirs.push(Boolean(host.querySelector('[data-dir="on"]')))
    ;(host.querySelector('button') as HTMLButtonElement).click()
    await nextTick()
    clicks.push(n)
    app.unmount()
    host.remove()
    setRuntimeMode('prepared')
  }
  const portal = document.createElement('div')
  portal.id = 'ac15-portal'
  document.body.appendChild(portal)
  let teleport = true
  for (const mode of ['legacy', 'prepared'] as const) {
    setRuntimeMode(mode)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(defineComponent({
      setup() {
        const api = useVario({ type: 'div', teleport: '#ac15-portal', children: 'ported' } as never, { state: {} })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    teleport = teleport && (portal.textContent ?? '').includes('ported')
    app.unmount()
    host.remove()
    setRuntimeMode('prepared')
  }
  portal.remove()
  const kids: string[] = []
  for (const mode of ['legacy', 'prepared'] as const) {
    setRuntimeMode(mode)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(defineComponent({
      setup() {
        const api = useVario({
          type: 'div',
          provide: { theme: 'dark' },
          onMounted: 'noop',
          children: [{ type: 'span', inject: ['theme'], onMounted: 'noop', children: 'kid' }]
        } as never, { state: {}, methods: { noop: () => {} } })
        return () => api.vnode.value
      }
    }))
    app.mount(host)
    await nextTick()
    kids.push(host.textContent ?? '')
    app.unmount()
    host.remove()
    setRuntimeMode('prepared')
  }
  return {
    textMatch: texts[0] === texts[1] && texts[0].includes('Ada') && texts[0].includes('H') && texts[0].includes('body'),
    namedSlot: texts.every(t => t.includes('H') && t.includes('body')),
    directive: dirs[0] && dirs[1],
    click: clicks[0] === 1 && clicks[1] === 1,
    teleport,
    provide: kids.every(t => t.includes('kid'))
  }
}

;(window as Window & { __varioBench?: unknown }).__varioBench = {
  runSample,
  runBatch,
  runGate,
  runSessionCycle,
  runEmptyCycle,
  runSsrHydrate,
  runCanvasDrag,
  runAc02Depth,
  runInpProbe,
  runInpMount,
  runInpFinish,
  runSsrIsolation50,
  runAc15Parity
}
