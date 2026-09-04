import type { PreparedNode, VarioDiagnostic } from '@variojs/types'
import type { SchemaNode } from '@variojs/types'
import { traverseIterative, type TraverseBudget } from './traverse-iterative.js'

export type PrepareIndex = {
  nodes: PreparedNode[]
  idMap: Map<string, string>
  childIdBuf: WeakMap<SchemaNode, string[]>
  sourceById: Map<string, SchemaNode>
  writes: number
  nodeCount: number
  maxDepth: number
}

export function buildPrepareIndex(
  root: SchemaNode,
  budget: TraverseBudget = {}
): PrepareIndex {
  const nodes: PreparedNode[] = []
  const idMap = new Map<string, string>()
  const parentIds = new WeakMap<SchemaNode, string>()
  const childIdBuf = new WeakMap<SchemaNode, string[]>()
  const sourceById = new Map<string, SchemaNode>()
  const diagnostics: VarioDiagnostic[] = []
  let writes = 0

  const stats = traverseIterative(root, ({ node, path, depth, parent }) => {
    const explicitId = (node as { id?: unknown }).id
    const stableId = typeof explicitId === 'string' && explicitId ? explicitId : `node:${path || 'root'}`
    if (idMap.has(stableId) && typeof explicitId === 'string') {
      diagnostics.push({
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node id "${stableId}"`,
        path,
        phase: 'prepare'
      })
      throw new Error(`Duplicate node id "${stableId}"`)
    }
    idMap.set(stableId, path)
    writes++
    const parentId = parent ? parentIds.get(parent) ?? null : null
    parentIds.set(node, stableId)
    writes++
    if (parent) {
      const list = childIdBuf.get(parent) ?? []
      list.push(stableId)
      childIdBuf.set(parent, list)
      writes++
    }
    childIdBuf.set(node, childIdBuf.get(node) ?? [])
    sourceById.set(stableId, node)
    nodes.push({
      id: stableId,
      type: node.type,
      componentType: node.type,
      path,
      schemaPath: path,
      depth,
      parentId,
      childIds: [],
      region: 'static'
    })
  }, budget)

  return { nodes, idMap, childIdBuf, sourceById, writes, nodeCount: stats.nodeCount, maxDepth: stats.maxDepth }
}
