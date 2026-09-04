import type { SchemaDocument, SchemaNode, VarioDiagnostic } from '@variojs/types'
import type { DiagnosticSink } from '@variojs/core'

function isSchemaDocument(value: unknown): value is SchemaDocument {
  if (!value || typeof value !== 'object') return false
  if (!('version' in value) || !('root' in value)) return false
  const version = (value as SchemaDocument).version
  const root = (value as SchemaDocument).root
  return (version === 0 || version === 1) && !!root && typeof root === 'object' && 'type' in (root as object)
}

function documentId(root: SchemaNode): string {
  const id = (root as { id?: unknown }).id
  return typeof id === 'string' && id ? id : 'doc:root'
}

function materialVersionsOf(doc: Pick<SchemaDocument, 'materials' | 'materialVersions'>): Readonly<Record<string, string>> | undefined {
  if (doc.materialVersions) return doc.materialVersions
  if (!doc.materials?.length) return undefined
  const out: Record<string, string> = {}
  for (const material of doc.materials) {
    const key = material.type ?? material.name
    if (key) out[key] = material.version
  }
  return Object.keys(out).length ? Object.freeze(out) : undefined
}

export function wrapLegacy(input: unknown, options?: { diagnosticSink?: DiagnosticSink }): SchemaDocument {
  const doc = migrateToV1(input)
  options?.diagnosticSink?.emit({
    name: 'schema-migrate',
    diagnostic: { code: 'SCHEMA_MIGRATE', message: 'schema-migrate', path: '', phase: 'migrate' }
  })
  return doc
}

export function migrateToV1(input: unknown): SchemaDocument {
  if (isSchemaDocument(input)) {
    const next: SchemaDocument = {
      version: 1,
      schemaVersion: 1,
      id: input.id ?? documentId(input.root),
      root: input.root
    }
    if (input.initialState) (next as { initialState: typeof input.initialState }).initialState = input.initialState
    if (input.materials) (next as { materials: typeof input.materials }).materials = input.materials
    if (input.extensions) (next as { extensions: typeof input.extensions }).extensions = input.extensions
    const versions = materialVersionsOf(input)
    if (versions) (next as { materialVersions: typeof versions }).materialVersions = versions
    return next
  }
  const root = input as SchemaNode
  return {
    version: 1,
    schemaVersion: 1,
    id: documentId(root),
    root
  }
}

export function rollbackToV0(doc: SchemaDocument): SchemaDocument {
  return { version: 0, root: doc.root, materials: doc.materials }
}

export function migrateIdempotent(doc: SchemaDocument): SchemaDocument {
  return migrateToV1(migrateToV1(doc))
}

export function describeDocument(doc: SchemaDocument): VarioDiagnostic {
  const materials = (doc.materials ?? []).map(m => ({ name: m.name, version: m.version }))
  return Object.freeze({
    code: 'DOCUMENT_VERSION',
    message: `SchemaDocument version ${doc.version}`,
    path: '',
    phase: 'migrate',
    metadata: Object.freeze({
      version: doc.version,
      schemaVersion: doc.schemaVersion ?? doc.version,
      id: doc.id,
      materials: Object.freeze(materials),
      materialVersions: doc.materialVersions ?? Object.freeze(Object.fromEntries(materials.map(m => [m.name, m.version])))
    })
  })
}
