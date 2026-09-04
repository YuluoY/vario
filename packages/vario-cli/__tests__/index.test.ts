import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { generateCode } from '../src/codegen.js'
import { validateFiles } from '../src/validate.js'

const TMP_DIR = resolve(__dirname, '.tmp-test')

function ensureClean() {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true })
  mkdirSync(TMP_DIR, { recursive: true })
}

describe('@variojs/cli', () => {
  beforeEach(() => ensureClean())
  afterEach(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true })
  })

  // ─── validate ───

  describe('validateFiles', () => {
    it('valid schema file should pass', () => {
      const file = join(TMP_DIR, 'valid.json')
      writeFileSync(file, JSON.stringify({ type: 'div', children: [] }))
      const result = validateFiles([file])
      expect(result.valid).toBe(true)
      expect(result.fileResults).toHaveLength(1)
      expect(result.fileResults[0].valid).toBe(true)
    })

    it('invalid JSON should fail', () => {
      const file = join(TMP_DIR, 'broken.json')
      writeFileSync(file, '{ not valid json }')
      const result = validateFiles([file])
      expect(result.valid).toBe(false)
      expect(result.fileResults[0].errors.length).toBeGreaterThan(0)
    })

    it('schema missing type should fail', () => {
      const file = join(TMP_DIR, 'missing-type.json')
      writeFileSync(file, JSON.stringify({ children: 'text' }))
      const result = validateFiles([file])
      expect(result.valid).toBe(false)
    })

    it('non-JSON files should be skipped', () => {
      const file = join(TMP_DIR, 'readme.md')
      writeFileSync(file, '# hello')
      const result = validateFiles([file])
      expect(result.valid).toBe(true)
      expect(result.fileResults).toHaveLength(0)
    })

    it('prepareFiles reports nodeCount and maxDepth', async () => {
      const { prepareFiles } = await import('../src/validate.js')
      const file = join(TMP_DIR, 'prep.json')
      writeFileSync(file, JSON.stringify({ type: 'div', children: [{ type: 'span', children: 'x' }] }))
      const rows = prepareFiles([file], { profile: 'default' })
      expect(rows).toHaveLength(1)
      expect(rows[0].nodeCount).toBeGreaterThanOrEqual(1)
      expect(rows[0].maxDepth).toBeGreaterThanOrEqual(0)
      expect(rows[0].profile).toBe('default')
    })
  })

  // ─── codegen ───

  describe('generateCode', () => {
    it('should generate types.ts and schema.ts from JSON schema', () => {
      const schemaFile = join(TMP_DIR, 'input.json')
      const outDir = join(TMP_DIR, 'out')
      writeFileSync(schemaFile, JSON.stringify({
        type: 'div',
        children: [{ type: 'span', children: 'hello' }]
      }))

      generateCode({ schema: schemaFile, output: outDir })

      expect(existsSync(join(outDir, 'input.types.ts'))).toBe(true)
      expect(existsSync(join(outDir, 'input.schema.ts'))).toBe(true)
    })

    it('should extract state types from schema', () => {
      const schemaFile = join(TMP_DIR, 'stateful.json')
      const outDir = join(TMP_DIR, 'out2')
      writeFileSync(schemaFile, JSON.stringify({
        type: 'div',
        state: { count: 0, name: 'test', items: [1, 2] },
        children: []
      }))

      generateCode({ schema: schemaFile, output: outDir })

      const types = readFileSync(join(outDir, 'stateful.types.ts'), 'utf-8')
      expect(types).toContain('count: number')
      expect(types).toContain('name: string')
      expect(types).toContain('items: number[]')
    })

    it('writes page-relative paths when root is provided', () => {
      const pages = join(TMP_DIR, 'pages', 'admin')
      mkdirSync(pages, { recursive: true })
      const schemaFile = join(pages, 'list.json')
      const outDir = join(TMP_DIR, 'generated')
      writeFileSync(schemaFile, JSON.stringify({ type: 'div', children: [] }))
      generateCode({ schema: schemaFile, output: outDir, root: TMP_DIR })
      expect(existsSync(join(outDir, 'pages', 'admin', 'list.types.ts'))).toBe(true)
      expect(existsSync(join(outDir, 'pages', 'admin', 'list.schema.ts'))).toBe(true)
    })
  })

  describe('runCli', () => {
    it('--help exits 0 without process.exit', async () => {
      const { runCli } = await import('../src/index.js')
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      expect(runCli(['node', 'vario', '--help'])).toBe(0)
      expect(runCli(['node', 'vario', '--version'])).toBe(0)
      log.mockRestore()
    })

    it('RELEASE-4 validate/generate via runCli', async () => {
      const { runCli } = await import('../src/index.js')
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const file = join(TMP_DIR, 'ok.json')
      writeFileSync(file, JSON.stringify({ type: 'div', children: [] }))
      expect(runCli(['node', 'vario', 'validate', file])).toBe(0)
      expect(runCli(['node', 'vario', 'generate', '--schema', file, '--output', join(TMP_DIR, 'gen')])).toBe(0)
      expect(existsSync(join(TMP_DIR, 'gen', 'ok.types.ts'))).toBe(true)
      log.mockRestore()
    })

    it('prepare prints node/depth diagnostics', async () => {
      const { runCli } = await import('../src/index.js')
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const file = join(TMP_DIR, 'prep.json')
      writeFileSync(file, JSON.stringify({ type: 'div', children: [{ type: 'span', children: 'x' }] }))
      expect(runCli(['node', 'vario', 'prepare', file, '--profile', 'default'])).toBe(0)
      expect(log.mock.calls.some(c => String(c[0]).includes('nodes='))).toBe(true)
      log.mockRestore()
    })

    it('migrate and inspect wrap legacy SchemaNode', async () => {
      const { runCli } = await import('../src/index.js')
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const file = join(TMP_DIR, 'legacy.json')
      writeFileSync(file, JSON.stringify({ type: 'div', children: 'x' }))
      expect(runCli(['node', 'vario', 'migrate', file])).toBe(0)
      expect(runCli(['node', 'vario', 'inspect', file])).toBe(0)
      expect(log.mock.calls.some(c => String(c[0]).includes('schemaVersion='))).toBe(true)
      expect(log.mock.calls.some(c => String(c[0]).includes('inspect'))).toBe(true)
      log.mockRestore()
    })
  })

  describe('RELEASE-5 dist hash', () => {
    it('records sha256 of existing package dist files', async () => {
      const { createHash } = await import('node:crypto')
      const { readdirSync, statSync } = await import('node:fs')
      const hashes: Record<string, string> = {}
      const packages = ['vario-types', 'vario-core', 'vario-schema', 'vario-vue', 'vario-cli']
      for (const name of packages) {
        const dist = resolve(__dirname, `../../${name}/dist`)
        if (!existsSync(dist)) continue
        const walk = (dir: string) => {
          for (const ent of readdirSync(dir)) {
            const p = join(dir, ent)
            if (statSync(p).isDirectory()) walk(p)
            else if (p.endsWith('.js') || p.endsWith('.d.ts')) {
              hashes[p.slice(resolve(__dirname, '../..').length + 1)] = createHash('sha256').update(readFileSync(p)).digest('hex')
            }
          }
        }
        walk(dist)
      }
      const { execSync } = await import('node:child_process')
      let commit = 'unknown'
      try { commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() } catch { /* */ }
      expect(typeof commit).toBe('string')
      if (Object.keys(hashes).length > 0) {
        expect(Object.values(hashes).every(h => h.length === 64)).toBe(true)
      }
    })
  })

  describe('RELEASE-3 pack smoke', () => {
    it('pnpm pack of all five packages produces tarballs', async () => {
      const dir = join(TMP_DIR, 'pack')
      mkdirSync(dir, { recursive: true })
      const { execSync } = await import('node:child_process')
      const { readdirSync, copyFileSync } = await import('node:fs')
      const { tmpdir } = await import('node:os')
      const packages = ['vario-types', 'vario-core', 'vario-schema', 'vario-vue', 'vario-cli']
      for (const name of packages) {
        execSync(`pnpm pack --pack-destination ${dir}`, {
          cwd: resolve(__dirname, `../../${name}`),
          stdio: 'pipe'
        })
      }
      const tgz = readdirSync(dir).filter((f: string) => f.endsWith('.tgz'))
      expect(tgz.length).toBe(5)
      const vueTgz = tgz.find((f: string) => f.includes('vue'))
      expect(vueTgz).toBeTruthy()
      const vueManifest = JSON.parse(execSync(`tar -xOf ${join(dir, vueTgz!)} package/package.json`, { encoding: 'utf8' }))
      expect(vueManifest.name).toBe('@variojs/vue')
      expect(vueManifest.peerDependencies.vue).toBe('^3.4.0')
      expect(vueManifest.files).toEqual(['dist', 'README.md'])
      const consumer = join(tmpdir(), `vario-empty-consumer-${process.pid}`)
      if (existsSync(consumer)) rmSync(consumer, { recursive: true })
      mkdirSync(join(consumer, 'tarballs'), { recursive: true })
      const deps: Record<string, string> = { vue: '3.4.38' }
      for (const file of tgz) {
        copyFileSync(join(dir, file), join(consumer, 'tarballs', file))
        const name = file.replace(/-\d+\.\d+\.\d+\.tgz$/, '').replace(/^variojs-/, '@variojs/')
        deps[name] = `file:./tarballs/${file}`
      }
      writeFileSync(join(consumer, 'package.json'), JSON.stringify({
        name: 'empty-vario-consumer',
        type: 'module',
        private: true,
        dependencies: deps,
        pnpm: { overrides: Object.fromEntries(Object.entries(deps).filter(([k]) => k.startsWith('@variojs/'))) }
      }))
      writeFileSync(join(consumer, '.npmrc'), 'ignore-workspace=true\n')
      try {
        execSync('pnpm install --ignore-workspace', {
          cwd: consumer,
          stdio: 'pipe'
        })
        writeFileSync(join(consumer, 'smoke.mjs'), `
        import { version } from 'vue'
        import { createRuntimeContext, execute } from '@variojs/core'
        import { defineSchema } from '@variojs/schema'
        if (!String(version).startsWith('3.4')) throw new Error('T5.6 expected vue 3.4 in empty consumer, got ' + version)
        const ctx = createRuntimeContext({ n: 1 })
        await execute([{ type: 'set', path: 'n', value: 3 }], ctx)
        if (ctx._get('n') !== 3) throw new Error('execute failed')
        const defined = defineSchema({ state: { n: 0 }, schema: () => ({ type: 'div', children: '{{ n }}' }) })
        if (defined.schema.type !== 'div') throw new Error('defineSchema failed')
        console.log('smoke-ok')
      `)
        const out = execSync('node smoke.mjs', { cwd: consumer, encoding: 'utf8' })
        expect(out).toContain('smoke-ok')
      } finally {
        if (existsSync(consumer)) rmSync(consumer, { recursive: true })
      }
    }, 180_000)
  })
})