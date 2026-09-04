import type { PreparedView } from '@variojs/types'
import type { SchemaNode } from '@variojs/schema'
import { prepareView } from '@variojs/schema'

export type ShadowDiff = {
  nodeId: string
  path: string
  field: string
  legacy: unknown
  prepared: unknown
}

function canonicalNode(node: { id: string; type: string; path: string; region: string; childIds: readonly string[] }) {
  return {
    id: node.id,
    type: node.type,
    path: node.path,
    region: node.region,
    childIds: [...node.childIds]
  }
}

export function compareShadowPlans(legacySchema: SchemaNode, prepared: PreparedView): ShadowDiff[] {
  const expected = prepareView(legacySchema)
  const diffs: ShadowDiff[] = []
  if (expected.nodeCount !== prepared.nodeCount) {
    diffs.push({
      nodeId: 'root',
      path: '',
      field: 'nodeCount',
      legacy: expected.nodeCount,
      prepared: prepared.nodeCount
    })
  }
  const preparedById = prepared.nodes
  for (const node of expected.nodes.values()) {
    const other = preparedById.get(node.id)
    if (!other) {
      diffs.push({
        nodeId: node.id,
        path: node.path,
        field: 'missing',
        legacy: canonicalNode(node),
        prepared: null
      })
      continue
    }
    if (node.region !== other.region) {
      diffs.push({
        nodeId: node.id,
        path: node.path,
        field: 'region',
        legacy: node.region,
        prepared: other.region
      })
    }
    if (node.type !== other.type) {
      diffs.push({
        nodeId: node.id,
        path: node.path,
        field: 'type',
        legacy: node.type,
        prepared: other.type
      })
    }
  }
  return diffs
}
