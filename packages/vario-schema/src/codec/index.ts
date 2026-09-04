import type { SchemaDocument, SchemaNode } from '@variojs/types'
import type { DiagnosticSink } from '@variojs/core'

export type { SchemaDocument }

const hostOnly = new WeakMap<object, Record<string, unknown>>()

export function getHostOnlyExtensions(node: object): Record<string, unknown> | undefined {
  return hostOnly.get(node)
}

function isHostOnly(value: unknown): boolean {
  return typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint' ||
    value instanceof RegExp
}

export function toJsonSafe(value: unknown, host?: Record<string, unknown>, path = '$'): unknown {
  if (value == null) return value
  if (isHostOnly(value)) {
    if (host) host[path] = value
    return undefined
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => {
      const cloned = toJsonSafe(item, host, `${path}[${i}]`)
      return cloned === undefined ? null : cloned
    })
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const cloned = toJsonSafe(item, host, `${path}.${key}`)
      if (cloned !== undefined) out[key] = cloned
    }
    return out
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (host) host[path] = value
  return undefined
}

export function serializeSchema(node: SchemaNode): string {
  const host: Record<string, unknown> = {}
  const root = toJsonSafe(node, host)
  if (Object.keys(host).length > 0) hostOnly.set(node as object, host)
  return JSON.stringify({ version: 1 as const, root })
}

export function parseSchema(raw: string, options?: { diagnosticSink?: DiagnosticSink }): SchemaDocument {
  const value = JSON.parse(raw) as unknown
  const asObj = value && typeof value === 'object' ? value as Record<string, unknown> : null
  const doc: SchemaDocument = asObj && 'version' in asObj && 'root' in asObj
    ? {
        version: (asObj.version as SchemaDocument['version']) === 1 ? 1 as const : 0 as const,
        root: asObj.root as SchemaDocument['root'],
        ...(typeof asObj.schemaVersion === 'number' ? { schemaVersion: asObj.schemaVersion as SchemaDocument['schemaVersion'] } : {}),
        ...(typeof asObj.id === 'string' ? { id: asObj.id } : {}),
        ...(asObj.initialState && typeof asObj.initialState === 'object' ? { initialState: asObj.initialState as SchemaDocument['initialState'] } : {}),
        ...(Array.isArray(asObj.materials) ? { materials: asObj.materials as SchemaDocument['materials'] } : {}),
        ...(asObj.materialVersions && typeof asObj.materialVersions === 'object' ? { materialVersions: asObj.materialVersions as SchemaDocument['materialVersions'] } : {}),
        ...(asObj.extensions && typeof asObj.extensions === 'object' ? { extensions: asObj.extensions as SchemaDocument['extensions'] } : {})
      }
    : { version: 0 as const, root: value as SchemaNode }
  options?.diagnosticSink?.emit({
    name: 'schema-load',
    diagnostic: { code: 'SCHEMA_LOAD', message: 'schema-load', path: '', phase: 'load' }
  })
  return doc
}
