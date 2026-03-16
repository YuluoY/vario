import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
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

      expect(existsSync(join(outDir, 'types.ts'))).toBe(true)
      expect(existsSync(join(outDir, 'schema.ts'))).toBe(true)
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

      const { readFileSync } = require('fs')
      const types = readFileSync(join(outDir, 'types.ts'), 'utf-8')
      expect(types).toContain('count: number')
      expect(types).toContain('name: string')
      expect(types).toContain('items: number[]')
    })
  })
})