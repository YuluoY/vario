import type { SchemaNode } from '@variojs/types'
import { ErrorCodes, VarioError } from '@variojs/core'

export type CanvasPatchRecord = {
  readonly id: string
  readonly path: string
  readonly before: Partial<SchemaNode>
  readonly after: Partial<SchemaNode>
  readonly affectedIds: readonly string[]
  readonly revision: number
}

export type CanvasReorderRecord = {
  readonly parentPath: string
  readonly from: number
  readonly to: number
  readonly movedId: string
}

export function snapshotNode(node: SchemaNode): Partial<SchemaNode> {
  return JSON.parse(JSON.stringify({
    type: node.type,
    id: (node as { id?: string }).id,
    props: node.props,
    children: node.children,
    events: (node as { events?: unknown }).events,
    loop: node.loop
  }))
}

export function applyPartial(node: SchemaNode, partial: Partial<SchemaNode>): void {
  Object.assign(node, partial)
}

export function detectPatchConflict(
  current: Partial<SchemaNode>,
  expectedBefore: Partial<SchemaNode>
): boolean {
  return JSON.stringify(current) !== JSON.stringify(expectedBefore)
}

export function assertNoPatchConflict(
  current: Partial<SchemaNode>,
  expectedBefore: Partial<SchemaNode>
): void {
  if (detectPatchConflict(current, expectedBefore)) {
    throw new VarioError('Patch conflict', ErrorCodes.SCHEMA_VALIDATION_ERROR)
  }
}
