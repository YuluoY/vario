/**
 * Code generation utilities
 * 
 * 功能：
 * - Schema 生成
 * - 类型定义生成
 * - 模板系统
 */

import type { Schema } from '@variojs/schema'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, basename, relative, dirname } from 'path'

export interface CodegenOptions {
  template?: string
  output?: string
  schema?: string
  root?: string
}

export function generateCode(options: CodegenOptions = {}) {
  const { template, output = './generated', schema } = options
  
  console.log('Code generation - Basic implementation')
  
  if (template) {
    console.log(`Using template: ${template}`)
  }
  
  if (schema) {
    console.log(`Loading schema from: ${schema}`)
    try {
      const schemaContent = readFileSync(schema, 'utf-8')
      const schemaData = JSON.parse(schemaContent) as Schema
      generateFromSchema(schemaData, output, schema, options.root)
    } catch (error) {
      console.error('Failed to load schema:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  } else {
    console.log('No schema provided, using default template')
  }
}

/**
 * 从 Schema 生成代码
 */
function generateFromSchema(schema: Schema, outputDir: string, schemaPath: string, root?: string) {
  const relBase = root
    ? relative(root, schemaPath).replace(/\.[^.]+$/, '') || 'schema'
    : basename(schemaPath).replace(/\.[^.]+$/, '') || 'schema'
  const dirPart = dirname(relBase)
  const outDir = dirPart === '.' ? outputDir : join(outputDir, dirPart)
  mkdirSync(outDir, { recursive: true })
  const base = basename(relBase)
  const typeDefs = generateTypeDefinitions(schema)
  writeFileSync(join(outDir, `${base}.types.ts`), typeDefs)
  const schemaFile = generateSchemaFile(schema)
  writeFileSync(join(outDir, `${base}.schema.ts`), schemaFile)
  console.log(`Generated files in ${outDir}`)
}

/**
 * 生成类型定义
 */
function generateTypeDefinitions(schema: Schema): string {
  const state = (schema as Record<string, unknown>).state as Record<string, unknown> | undefined
  const stateFields = state
    ? Object.entries(state).map(([key, val]) => {
        const tsType = inferTsType(val)
        return `  ${key}: ${tsType}`
      }).join('\n')
    : '  [key: string]: unknown'

  return `/**
 * Auto-generated type definitions
 * Generated from Vario Schema
 */

export interface State {
${stateFields}
}
`
}

/**
 * 推断 JS 值对应的 TypeScript 类型
 */
function inferTsType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]'
    const elemType = inferTsType(value[0])
    return `${elemType}[]`
  }
  switch (typeof value) {
    case 'string': return 'string'
    case 'number': return 'number'
    case 'boolean': return 'boolean'
    default: return 'unknown'
  }
}

/**
 * 生成 Schema 文件
 */
function generateSchemaFile(schema: Schema): string {
  return `/**
 * Auto-generated schema file
 * Generated from Vario Schema
 */

import type { Schema } from '@variojs/schema'

export const schema: Schema = ${JSON.stringify(schema, null, 2)} as Schema
`
}