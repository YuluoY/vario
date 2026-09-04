/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { version as vueVersion } from 'vue'
import { useVario, defineMethod, VueRenderer, setRuntimeMode, getRuntimeMode, renderSsrToString } from '../../../packages/vario-vue/src/index.js'
import { defineSchema } from '../../../packages/vario-schema/src/index.js'
import { execute, createRuntimeContext } from '../../../packages/vario-core/src/index.js'

function flatSchema(n: number) {
  return {
    type: 'div',
    children: Array.from({ length: n }, (_, i) => ({ type: 'span', children: `n-${i}` }))
  }
}

describe('COMP consumer public-api', () => {
  it('exports the documented facade', () => {
    expect(typeof useVario).toBe('function')
    expect(typeof defineMethod).toBe('function')
    expect(typeof VueRenderer).toBe('function')
    expect(typeof defineSchema).toBe('function')
    expect(typeof execute).toBe('function')
  })

  it('execute(actions, ctx) still writes state', async () => {
    const ctx = createRuntimeContext({ n: 1 })
    await execute([{ type: 'set', path: 'n', value: 2 }], ctx)
    expect(ctx._get('n')).toBe(2)
  })

  it('COMP-6 frozen facade names stay exported', async () => {
    const core = await import('../../../packages/vario-core/src/index.js')
    const schema = await import('../../../packages/vario-schema/src/index.js')
    for (const name of ['createRuntimeContext', 'execute', 'evaluate', 'registerCapability', 'createDiagnosticSink']) {
      expect(typeof (core as Record<string, unknown>)[name]).toBe('function')
    }
    for (const name of ['defineSchema', 'prepareView', 'normalizeEventHandler', 'validateSchema']) {
      expect(typeof (schema as Record<string, unknown>)[name]).toBe('function')
    }
    expect(typeof useVario).toBe('function')
    expect(typeof renderSsrToString).toBe('function')
    expect(getRuntimeMode()).toBe('legacy')
  })

  it('COMP-6 frozen runtime export keys match snapshot', async () => {
    const { mkdirSync, readFileSync, writeFileSync, existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const core = await import('../../../packages/vario-core/src/index.js')
    const schema = await import('../../../packages/vario-schema/src/index.js')
    const vue = await import('../../../packages/vario-vue/src/index.js')
    const cli = await import('../../../packages/vario-cli/src/index.js')
    const root = resolve(__dirname, '../../..')
    const readExports = (pkg: string) => Object.keys(JSON.parse(readFileSync(resolve(root, 'packages', pkg, 'package.json'), 'utf8')).exports).sort()
    const current = {
      core: Object.keys(core).sort(),
      schema: Object.keys(schema).sort(),
      vue: Object.keys(vue).sort(),
      cli: Object.keys(cli).sort(),
      packageExports: {
        '@variojs/core': readExports('vario-core'),
        '@variojs/schema': readExports('vario-schema'),
        '@variojs/vue': readExports('vario-vue'),
        '@variojs/cli': readExports('vario-cli'),
        '@variojs/types': readExports('vario-types')
      }
    }
    const dir = resolve(root, 'tests/consumer/public-api/snapshots')
    const snapshotPath = resolve(dir, 'exports.json')
    mkdirSync(dir, { recursive: true })
    if (!existsSync(snapshotPath)) {
      writeFileSync(snapshotPath, JSON.stringify(current, null, 2) + '\n')
    }
    const frozen = JSON.parse(readFileSync(snapshotPath, 'utf8')) as typeof current
    expect(current).toEqual(frozen)
  })

  it('COMP-6 type and constructor surface stays listed', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const root = resolve(__dirname, '../../..')
    const vueTypes = readFileSync(resolve(root, 'packages/vario-vue/src/types.ts'), 'utf8')
    for (const field of ['vnode', 'state', 'ctx', 'refs', 'error', 'stats', 'retry', 'dispose', 'virtualAdapter']) {
      expect(vueTypes).toContain(field)
    }
    const queryApi = readFileSync(resolve(root, 'packages/vario-vue/src/composables/useSchemaQuery.ts'), 'utf8')
    for (const field of ['find', 'findAll', 'findById']) {
      expect(queryApi).toContain(field)
    }
    const core = await import('../../../packages/vario-core/src/index.js')
    const schema = await import('../../../packages/vario-schema/src/index.js')
    const vue = await import('../../../packages/vario-vue/src/index.js')
    expect(typeof (core as { VarioError: unknown }).VarioError).toBe('function')
    expect(typeof (core as { ResultMemo: unknown }).ResultMemo).toBe('function')
    expect(typeof (schema as { CanvasWorkspace: unknown }).CanvasWorkspace).toBe('function')
    expect(typeof (vue as { VueRenderer: unknown }).VueRenderer).toBe('function')
    expect(typeof (vue as { PageSession: unknown }).PageSession).toBe('function')
    expect(typeof (vue as { VarioTeleport?: unknown }).createTeleport).toBe('function')
  })
})

describe('T5.6 consumer vue-depth matrix', () => {
  it('Vue peer is 3.4+ and current runtime is 3.4 or 3.5', () => {
    expect(vueVersion.startsWith('3.4') || vueVersion.startsWith('3.5')).toBe(true)
    if (process.env.VARIO_VUE_RESOLVE) {
      expect(vueVersion.startsWith('3.4')).toBe(true)
    }
  })

  it.each([200, 1000] as const)('CSR/SSR render %s nodes and mode rollback keeps the same facade', async (n) => {
    const { createApp, defineComponent, nextTick } = await import('vue')
    const schema = flatSchema(n)
    const ctx = createRuntimeContext({})
    const vnode = new VueRenderer().render(schema as never, ctx)
    expect(vnode).toBeTruthy()
    const html = await renderSsrToString(schema as never, createRuntimeContext({}))
    expect(html.length).toBeGreaterThan(0)
    expect(html.includes('n-0')).toBe(true)
    const previous = getRuntimeMode()
    for (const mode of ['legacy', 'prepared'] as const) {
      setRuntimeMode(mode)
      const host = document.createElement('div')
      document.body.appendChild(host)
      let api: ReturnType<typeof useVario>
      const app = createApp(defineComponent({
        setup() {
          api = useVario(schema as never, { state: {} })
          return () => api.vnode.value
        }
      }))
      app.mount(host)
      await nextTick()
      expect(host.textContent).toContain('n-0')
      expect(host.textContent).toContain(`n-${n - 1}`)
      expect(typeof api!.retry).toBe('function')
      app.unmount()
      host.remove()
    }
    setRuntimeMode('legacy')
    expect(getRuntimeMode()).toBe('legacy')
    setRuntimeMode(previous)
  })
})
