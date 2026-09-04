import type { SchemaNode } from '@variojs/schema'
import { prepareView, wrapLegacy, type PrepareViewOptions } from '@variojs/schema'
import type { PreparedView } from '@variojs/types'

export function adaptLegacySchema(schema: SchemaNode, options?: PrepareViewOptions): PreparedView {
  return prepareView(wrapLegacy(schema, { diagnosticSink: options?.diagnosticSink }).root, options)
}

export function isLegacyDocument(schema: SchemaNode): boolean {
  return !('version' in schema) || (schema as { version?: number }).version == null || (schema as { version?: number }).version === 0
}
