import type { SchemaNode } from './schema.js'
import type { MaterialManifest } from './material.js'

export type NodeId = string
export type SchemaVersion = 0 | 1

export type SchemaDocument = {
  version: SchemaVersion
  schemaVersion?: SchemaVersion
  id?: string
  root: SchemaNode
  initialState?: Readonly<Record<string, unknown>>
  materials?: readonly MaterialManifest[]
  materialVersions?: Readonly<Record<string, string>>
  extensions?: Readonly<Record<string, unknown>>
}
