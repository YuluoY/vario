/**
 * Schema 验证命令
 *
 * 读取 JSON schema 文件并使用 @variojs/schema 的验证器校验。
 */

import { readFileSync } from 'fs'
import { validateSchemaWithResult, prepareView, wrapLegacy, describeDocument } from '@variojs/schema'
import type { ValidationOptions } from '@variojs/schema'

export type ValidateOptions = ValidationOptions

export interface ValidateResult {
  valid: boolean
  fileResults: Array<{
    file: string
    valid: boolean
    errors: string[]
  }>
}

/**
 * 验证 schema 文件列表
 */
export function validateFiles(files: string[], options: ValidateOptions = {}): ValidateResult {
  const fileResults: ValidateResult['fileResults'] = []
  let allValid = true

  for (const file of files) {
    // 仅验证 JSON 文件
    if (!file.endsWith('.json')) continue

    try {
      const content = readFileSync(file, 'utf-8')
      const schema = JSON.parse(content)
      const result = validateSchemaWithResult(schema, options)

      if (result.valid) {
        fileResults.push({ file, valid: true, errors: [] })
        console.log(`  ✓ ${file}`)
      } else {
        allValid = false
        const errors = result.errors.map(e => e.message)
        fileResults.push({ file, valid: false, errors })
        console.error(`  ✗ ${file}`)
        for (const err of errors) {
          console.error(`    - ${err}`)
        }
      }
    } catch (error) {
      allValid = false
      const msg = error instanceof Error ? error.message : String(error)
      fileResults.push({ file, valid: false, errors: [msg] })
      console.error(`  ✗ ${file}: ${msg}`)
    }
  }

  return { valid: allValid, fileResults }
}

export type PrepareFileResult = {
  file: string
  profile: string
  nodeCount: number
  maxDepth: number
  diagnostics: Array<{ code: string; message: string; path: string; phase: string }>
}

export function prepareFiles(
  files: string[],
  options: { profile?: string; maxDepth?: number; maxNodes?: number } = {}
): PrepareFileResult[] {
  const profile = options.profile ?? 'default'
  const results: PrepareFileResult[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const schema = JSON.parse(readFileSync(file, 'utf-8'))
    const view = prepareView(wrapLegacy(schema).root, { maxDepth: options.maxDepth, maxNodes: options.maxNodes })
    results.push({
      file,
      profile,
      nodeCount: view.nodeCount,
      maxDepth: view.maxDepth,
      diagnostics: view.diagnostics.map(d => ({
        code: d.code,
        message: d.message,
        path: d.path,
        phase: d.phase
      }))
    })
  }
  return results
}

export type MigrateFileResult = {
  file: string
  schemaVersion: number
  id: string
}

export function migrateFiles(files: string[]): MigrateFileResult[] {
  const results: MigrateFileResult[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const doc = wrapLegacy(JSON.parse(readFileSync(file, 'utf-8')))
    results.push({
      file,
      schemaVersion: doc.schemaVersion ?? doc.version,
      id: doc.id ?? 'doc:root'
    })
  }
  return results
}

export type InspectFileResult = {
  file: string
  id: string
  schemaVersion: number
  nodeCount: number
  maxDepth: number
  diagnostics: Array<{ code: string; message: string; path: string; phase: string }>
}

export function inspectFiles(files: string[]): InspectFileResult[] {
  const results: InspectFileResult[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const doc = wrapLegacy(JSON.parse(readFileSync(file, 'utf-8')))
    const view = prepareView(doc.root)
    const described = describeDocument(doc)
    results.push({
      file,
      id: doc.id ?? 'doc:root',
      schemaVersion: doc.schemaVersion ?? doc.version,
      nodeCount: view.nodeCount,
      maxDepth: view.maxDepth,
      diagnostics: [
        { code: described.code, message: described.message, path: described.path, phase: described.phase },
        ...view.diagnostics.map(d => ({
          code: d.code,
          message: d.message,
          path: d.path,
          phase: d.phase
        }))
      ]
    })
  }
  return results
}
