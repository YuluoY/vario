import type { SchemaNode } from '@variojs/types'
import { SchemaDepthError, VarioError, ErrorCodes } from '@variojs/core'

export type IterativeVisit = {
  node: SchemaNode
  path: string
  depth: number
  parent: SchemaNode | null
}

export type TraverseBudget = {
  maxDepth?: number
  maxNodes?: number
}

export function traverseIterative(
  root: SchemaNode,
  visit: (item: IterativeVisit) => boolean | void,
  budget: TraverseBudget = {}
): { nodeCount: number; maxDepth: number } {
  const maxDepth = budget.maxDepth ?? 10_000
  const maxNodes = budget.maxNodes ?? 1_000_000
  const stack: IterativeVisit[] = [{ node: root, path: '', depth: 1, parent: null }]
  const seen = new Set<SchemaNode>()
  let nodeCount = 0
  let max = 0

  while (stack.length > 0) {
    const current = stack.pop()!
    if (!current.node || typeof current.node !== 'object') continue
    if (seen.has(current.node)) {
      throw new VarioError(
        `Circular reference at ${current.path || 'root'}`,
        ErrorCodes.SCHEMA_CIRCULAR_REFERENCE,
        { schemaPath: current.path }
      )
    }
    if (current.depth > maxDepth) {
      throw new SchemaDepthError(`Schema depth ${current.depth} exceeds ${maxDepth}`, {
        schemaPath: current.path,
        metadata: {
          phase: 'prepare',
          node: String((current.node as { id?: unknown }).id ?? current.node.type ?? ''),
          path: current.path,
          actual: current.depth,
          limit: maxDepth
        }
      })
    }
    if (nodeCount + 1 > maxNodes) {
      throw new VarioError(
        `Schema node count exceeds ${maxNodes}`,
        ErrorCodes.SCHEMA_DEPTH_EXCEEDED,
        { schemaPath: current.path, metadata: { phase: 'prepare', actual: nodeCount + 1, limit: maxNodes } }
      )
    }
    seen.add(current.node)
    nodeCount++
    if (current.depth > max) max = current.depth
    if (visit(current) === false) break

    const children = current.node.children
    if (Array.isArray(children)) {
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i]
        if (child && typeof child === 'object') {
          stack.push({
            node: child as SchemaNode,
            path: current.path ? `${current.path}.children.${i}` : `children.${i}`,
            depth: current.depth + 1,
            parent: current.node
          })
        }
      }
    }
  }

  return { nodeCount, maxDepth: max }
}
