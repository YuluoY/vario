/**
 * RuntimeContext 创建测试
 */

import { describe, it, expect } from 'vitest'
import { createRuntimeContext } from '../../src/runtime/create-context'

describe('createRuntimeContext', () => {
  it('应该创建基本的运行时上下文', () => {
    const ctx = createRuntimeContext({
      user: { name: 'John', age: 30 }
    })
    
    expect(ctx.user).toEqual({ name: 'John', age: 30 })
    expect(ctx.$emit).toBeDefined()
    expect(ctx.$methods).toBeDefined()
    expect(ctx._get).toBeDefined()
    expect(ctx._set).toBeDefined()
  })
  
  it('应该拒绝冲突的属性名', () => {
    expect(() => {
      createRuntimeContext({
        $emit: 'invalid'  // 冲突
      })
    }).toThrow('conflicts with system API')
    
    expect(() => {
      createRuntimeContext({
        _get: 'invalid'  // 冲突
      })
    }).toThrow('conflicts with system API')
  })
  
  it('应该支持路径访问', () => {
    const ctx = createRuntimeContext({
      user: { name: 'John', age: 30 }
    })
    
    expect(ctx._get('user.name')).toBe('John')
    expect(ctx._get('user.age')).toBe(30)
  })
  
  it('应该支持路径设置', () => {
    const ctx = createRuntimeContext({
      user: { name: 'John' }
    })
    
    ctx._set('user.age', 30)
    expect(ctx.user.age).toBe(30)
  })
  
  it('应该防止覆盖系统 API', () => {
    const ctx = createRuntimeContext()
    
    expect(() => {
      ctx.$emit = () => {}
    }).toThrow('Cannot override system API')
    
    expect(() => {
      ctx._get = () => {}
    }).toThrow('Cannot override system API')
  })
  
  it('应该支持事件触发', () => {
    const events: Array<{ event: string; data?: any }> = []
    const ctx = createRuntimeContext({}, {
      onEmit: (event, data) => {
        events.push({ event, data })
      }
    })
    
    ctx.$emit('test', { value: 123 })
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('test')
    expect(events[0].data).toEqual({ value: 123 })
  })

  it('应该防止 $methods 被整体覆盖', () => {
    const ctx = createRuntimeContext()
    
    // 确保 $methods 是对象
    expect(typeof ctx.$methods).toBe('object')
    expect(ctx.$methods).not.toBeNull()
    
    // 尝试覆盖 $methods 为字符串应该抛出错误
    expect(() => {
      ctx.$methods = 'hacked' as any
    }).toThrow('Cannot override system API')
    
    // 尝试覆盖 $methods 为 null 应该抛出错误
    expect(() => {
      ctx.$methods = null as any
    }).toThrow('Cannot override system API')
    
    // 但可以向 $methods 添加新方法
    ctx.$methods.customMethod = () => 'custom'
    expect(ctx.$methods.customMethod()).toBe('custom')
  })
})

describe('BUNDLE-1/2 runtime subpath', () => {
  it('runtime dist has no babel parser and gzip ≤ 15KB', async () => {
    const { readFileSync } = await import('node:fs')
    const { gzipSync } = await import('node:zlib')
    const { resolve } = await import('node:path')
    const file = resolve(__dirname, '../../dist/runtime.js')
    const raw = readFileSync(file)
    const text = raw.toString()
    expect(text.includes('@babel/parser')).toBe(false)
    expect(gzipSync(raw).length).toBeLessThanOrEqual(15 * 1024)
  })

  it('BUNDLE-4 compiler chunk gzip ≤90KB and BUNDLE-5 sideEffects is false', async () => {
    const { readFileSync } = await import('node:fs')
    const { gzipSync } = await import('node:zlib')
    const { resolve } = await import('node:path')
    const compiler = readFileSync(resolve(__dirname, '../../dist/compiler.js'))
    expect(gzipSync(compiler).length).toBeLessThanOrEqual(90 * 1024)
    expect(compiler.toString()).toMatch(/parse\(/)
    expect(compiler.toString()).not.toMatch(/from['"]@babel\/parser['"]/)
    const runtime = readFileSync(resolve(__dirname, '../../dist/runtime.js')).toString()
    expect(runtime.includes('@babel/parser')).toBe(false)
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.sideEffects).toBe(false)
  })

  it('BUNDLE-5 each core subpath has a tree-shaking consumer probe', async () => {
    const { readFileSync } = await import('node:fs')
    const { gzipSync } = await import('node:zlib')
    const { resolve } = await import('node:path')
    const { createRequire } = await import('node:module')
    const require = createRequire(resolve(__dirname, '../../../../package.json'))
    const esbuild = require('esbuild') as typeof import('esbuild')
    const root = resolve(__dirname, '../..')
    const probes = [
      { entry: resolve(root, 'dist/runtime.js'), mustNot: '@babel/parser', maxGzip: 15 * 1024 },
      { entry: resolve(root, 'dist/compiler.js'), mustNotImport: '@babel/parser', maxGzip: 90 * 1024 }
    ]
    const { existsSync } = await import('node:fs')
    for (const name of ['expression.js', 'vm.js', 'schema-tools.js'] as const) {
      expect(existsSync(resolve(root, 'dist', name))).toBe(true)
    }
    for (const probe of probes) {
      const built = await esbuild.build({
        entryPoints: [probe.entry],
        bundle: true,
        format: 'esm',
        write: false,
        platform: 'neutral',
        packages: 'external'
      })
      const text = built.outputFiles[0].text
      if ('mustNot' in probe && probe.mustNot) expect(text.includes(probe.mustNot)).toBe(false)
      if ('mustNotImport' in probe && probe.mustNotImport) {
        expect(text).not.toMatch(new RegExp(`from['"]${probe.mustNotImport}['"]`))
      }
      if ('must' in probe && probe.must) expect(text).toContain(probe.must)
      expect(gzipSync(built.outputFiles[0].contents).length).toBeLessThanOrEqual(probe.maxGzip)
    }
    const typesPkg = JSON.parse(readFileSync(resolve(root, '../vario-types/package.json'), 'utf8'))
    const schemaPkg = JSON.parse(readFileSync(resolve(root, '../vario-schema/package.json'), 'utf8'))
    const vuePkg = JSON.parse(readFileSync(resolve(root, '../vario-vue/package.json'), 'utf8'))
    expect(typesPkg.sideEffects).toBe(false)
    expect(schemaPkg.sideEffects).toBe(false)
    expect(vuePkg.sideEffects).toBe(false)
  })
})

describe('StateStore and PageSessionManager', () => {
  it('StateStore write bumps version', async () => {
    const { StateStore } = await import('../../src/state/index.js')
    const owner = {}
    const store = new StateStore(owner)
    let seen = 0
    store.subscribe(() => { seen += 1 })
    store.write('n', 1)
    expect(store.revision).toBe(1)
    expect(store.version()).toBe(1)
    expect(store.version('n')).toBe(1)
    expect(seen).toBe(1)
  })

  it('StateStore read/mutate/pathVersion/dispose', async () => {
    const { StateStore } = await import('../../src/state/index.js')
    const { createRuntimeContext } = await import('../../src/runtime/create-context.js')
    const ctx = createRuntimeContext({ n: 1 })
    const store = new StateStore(ctx)
    store.subscribe(() => {})
    expect(store.read('n')).toBe(1)
    store.mutate('n', current => (current as number) + 1)
    expect(store.read('n')).toBe(2)
    expect(store.pathVersion('n')).toBe(1)
    store.dispose()
    expect(() => store.write('n', 3)).toThrow(/disposed/i)
    expect(store.pathVersion('n')).toBe(1)
  })

  it('StateStore pause coalesces into one resume revision', async () => {
    const { StateStore } = await import('../../src/state/index.js')
    const { createRuntimeContext } = await import('../../src/runtime/create-context.js')
    const ctx = createRuntimeContext({ n: 1 })
    const store = new StateStore(ctx)
    let seen = 0
    let lastPaths: readonly string[] = []
    store.subscribe(cs => {
      seen += 1
      lastPaths = cs.paths
    })
    store.pause()
    store.write('n', 2)
    store.write('n', 3)
    expect(seen).toBe(0)
    expect(store.revision).toBe(0)
    store.resume()
    expect(seen).toBe(1)
    expect(store.revision).toBe(1)
    expect([...lastPaths]).toEqual(['n', 'n'])
    expect(store.read('n')).toBe(3)
  })

  it('paused StateStore skips execute until resume', async () => {
    const { StateStore } = await import('../../src/state/index.js')
    const { createRuntimeContext } = await import('../../src/runtime/create-context.js')
    const { execute } = await import('../../src/vm/executor.js')
    const ctx = createRuntimeContext({ n: 1 })
    const store = new StateStore(ctx)
    store.pause()
    await execute([{ type: 'set', path: 'n', value: 9 }], ctx)
    expect(store.read('n')).toBe(1)
    store.resume()
    await execute([{ type: 'set', path: 'n', value: 9 }], ctx)
    expect(store.read('n')).toBe(9)
  })

  it('PageSessionManager evicts LRU pages past maxResidentPages', async () => {
    const { PageSessionManager } = await import('../../src/runtime/page-session-manager.js')
    const manager = new PageSessionManager({ maxResidentPages: 2 })
    const make = () => {
      let status = 'paused'
      return {
        get status() { return status },
        pause() { status = 'paused' },
        resume() { status = 'active' },
        dispose() { status = 'disposed' }
      }
    }
    const a = make()
    const b = make()
    const c = make()
    manager.register('a', a)
    manager.register('b', b)
    manager.register('c', c)
    expect(manager.pages.size).toBe(2)
    expect(a.status).toBe('disposed')
  })
})

describe('Engine material registry', () => {
  it('registers materials on the engine, not a module-global table', async () => {
    const { registerEngineMaterial, getEngineMaterial, getOrCreateEngine } = await import('../../src/runtime/runtime-session.js')
    const engineA = getOrCreateEngine('mat-a')
    const engineB = getOrCreateEngine('mat-b')
    registerEngineMaterial('mat-a', { name: 'Card', version: '1.0.0' })
    expect(getEngineMaterial('mat-a', 'Card')?.version).toBe('1.0.0')
    expect(getEngineMaterial('mat-b', 'Card')).toBeUndefined()
    expect(engineA.materials.has('Card')).toBe(true)
    expect(engineB.materials.has('Card')).toBe(false)
  })

  it('registers materials by type as well as name', async () => {
    const { registerEngineMaterial, getEngineMaterial } = await import('../../src/runtime/runtime-session.js')
    registerEngineMaterial('mat-type', { name: 'CardX', type: 'CardType', version: '2.0.0' })
    expect(getEngineMaterial('mat-type', 'CardType')?.version).toBe('2.0.0')
    expect(getEngineMaterial('mat-type', 'CardX')?.version).toBe('2.0.0')
  })
})
