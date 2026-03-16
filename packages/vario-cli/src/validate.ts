/**
 * Schema 验证命令
 *
 * 读取 JSON schema 文件并使用 @variojs/schema 的验证器校验。
 */

import { readFileSync } from 'fs'
import { validateSchemaWithResult } from '@variojs/schema'
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
