/**
 * 迭代 Schema 扫描：显式栈，不依赖调用栈深度。
 */
import type { SchemaNode } from '@variojs/types'
import { SchemaDepthError, VarioError, ErrorCodes } from '../errors.js'

export const DEFAULT_MOUNT_MAX_DEPTH = 100
export const DEFAULT_SCAN_MAX_DEPTH = 10_000

export type SchemaScanResult = {
  maxDepth: number
  maxPath: string
  maxNode: string
  nodeCount: number
  circular: boolean
}

export function scanSchemaIterative(
  root: SchemaNode,
  options: { maxDepth?: number; throwOnCircular?: boolean } = {}
): SchemaScanResult {
  const limit = options.maxDepth ?? DEFAULT_SCAN_MAX_DEPTH
  const stack: Array<{ node: SchemaNode; depth: number; path: string }> = [
    { node: root, depth: 1, path: '' }
  ]
  const visiting = new Set<SchemaNode>()
  let maxDepth = 0
  let maxPath = ''
  let maxNode = ''
  let nodeCount = 0

  while (stack.length > 0) {
    const current = stack.pop()!
    if (!current.node || typeof current.node !== 'object') continue
    if (visiting.has(current.node)) {
      throw new VarioError(
        `Circular reference detected at ${current.path || 'root'}`,
        ErrorCodes.SCHEMA_CIRCULAR_REFERENCE,
        { schemaPath: current.path, metadata: { phase: 'scan', actual: current.depth } }
      )
    }
    visiting.add(current.node)
    nodeCount++
    if (current.depth > maxDepth) {
      maxDepth = current.depth
      maxPath = current.path
      maxNode = String((current.node as { id?: unknown }).id ?? current.node.type ?? '')
    }
    if (current.depth > limit) {
      throw new SchemaDepthError(
        `Schema depth ${current.depth} exceeds limit ${limit}`,
        {
          schemaPath: current.path,
          metadata: {
            phase: 'scan',
            node: String((current.node as { id?: unknown }).id ?? current.node.type ?? ''),
            path: current.path,
            actual: current.depth,
            limit
          }
        }
      )
    }

    const children = current.node.children
    if (Array.isArray(children)) {
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i]
        if (child && typeof child === 'object') {
          const childPath = current.path
            ? `${current.path}.children.${i}`
            : `children.${i}`
          stack.push({ node: child as SchemaNode, depth: current.depth + 1, path: childPath })
        }
      }
    }
  }

  return { maxDepth, maxPath, maxNode, nodeCount, circular: false }
}
