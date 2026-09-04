import type { PreparedNode, PreparedView, SchemaNode } from '@variojs/types'
import { ErrorCodes, VarioError, createQueryEngine, analyzeSchema, type DiagnosticSink } from '@variojs/core'
import { prepareView, getPreparedSources } from '../compiler/prepare-view.js'
import { recompileIncremental } from '../compiler/incremental/index.js'
import { snapshotNode, type CanvasPatchRecord, type CanvasReorderRecord } from '../patch/index.js'

export type { CanvasPatchRecord, CanvasReorderRecord }

export class CanvasWorkspace {
  root: SchemaNode
  view: PreparedView
  revision = 1
  readonly = false
  lastRecompiledIds: string[] = []
  private readonly undoStack: CanvasPatchRecord[] = []
  private readonly redoStack: CanvasPatchRecord[] = []
  private readonly sink?: DiagnosticSink

  constructor(root: SchemaNode, options: { readonly?: boolean; diagnosticSink?: DiagnosticSink } = {}) {
    this.root = root
    this.readonly = Boolean(options.readonly)
    this.sink = options.diagnosticSink
    this.view = prepareView(root, { revision: this.revision, diagnosticSink: options.diagnosticSink })
    this.sink?.emit({
      name: 'schema-load',
      diagnostic: { code: 'SCHEMA_LOAD', message: 'schema-load', path: '', phase: 'load' }
    })
  }

  findById(id: string) {
    const engine = createQueryEngine({
      schema: this.root,
      index: analyzeSchema(this.root, { buildPathMap: true }).index,
      readonly: this.readonly
    })
    const found = engine.findById(id)
    if (!found) return null
    return {
      ...found,
      patch: (partial: Partial<SchemaNode>) => this.patch(id, partial)
    }
  }

  patch(id: string, partial: Partial<SchemaNode>): PreparedView {
    if (this.readonly) {
      throw new VarioError('Schema is readonly', ErrorCodes.SCHEMA_READONLY)
    }
    const found = createQueryEngine({
      schema: this.root,
      index: analyzeSchema(this.root, { buildPathMap: true }).index
    }).findById(id)
    if (!found) {
      throw new VarioError(`Cannot patch missing node ${id}`, ErrorCodes.SCHEMA_VALIDATION_ERROR)
    }
    const before = snapshotNode(found.node)
    found.patch(partial)
    const after = snapshotNode(found.node)
    const previous = this.view
    this.revision += 1
    const incremental = recompileIncremental(this.root, previous, found.path, this.revision)
    this.lastRecompiledIds = incremental.affectedIds
    this.view = incremental.view
    const record: CanvasPatchRecord = {
      id,
      path: found.path,
      before,
      after,
      affectedIds: Object.freeze(incremental.affectedIds),
      revision: this.revision
    }
    this.undoStack.push(record)
    this.redoStack.length = 0
    this.sink?.emit({
      name: 'schema-patch',
      nodeId: id,
      count: incremental.affectedIds.length,
      diagnostic: { code: 'SCHEMA_PATCH', message: 'schema-patch', path: found.path, phase: 'patch' }
    })
    return this.view
  }

  applyRemote(record: CanvasPatchRecord): PreparedView {
    const found = createQueryEngine({
      schema: this.root,
      index: analyzeSchema(this.root, { buildPathMap: true }).index
    }).findById(record.id)
    if (!found) {
      throw new VarioError(`Cannot patch missing node ${record.id}`, ErrorCodes.SCHEMA_VALIDATION_ERROR)
    }
    const current = snapshotNode(found.node)
    if (JSON.stringify(current) !== JSON.stringify(record.before)) {
      throw new VarioError('Patch conflict', ErrorCodes.SCHEMA_VALIDATION_ERROR)
    }
    return this.patch(record.id, record.after)
  }

  undo(): PreparedView {
    const record = this.undoStack.pop()
    if (!record) return this.view
    const found = createQueryEngine({
      schema: this.root,
      index: analyzeSchema(this.root, { buildPathMap: true }).index
    }).findById(record.id)
    if (found) found.patch(record.before)
    this.revision += 1
    this.view = prepareView(this.root, { revision: this.revision })
    this.redoStack.push(record)
    this.sink?.emit({
      name: 'schema-patch',
      nodeId: record.id,
      diagnostic: { code: 'SCHEMA_PATCH', message: 'schema-patch', path: record.path, phase: 'patch' }
    })
    return this.view
  }

  redo(): PreparedView {
    const record = this.redoStack.pop()
    if (!record) return this.view
    const found = createQueryEngine({
      schema: this.root,
      index: analyzeSchema(this.root, { buildPathMap: true }).index
    }).findById(record.id)
    if (found) found.patch(record.after)
    this.revision += 1
    this.view = prepareView(this.root, { revision: this.revision })
    this.undoStack.push(record)
    this.sink?.emit({
      name: 'schema-patch',
      nodeId: record.id,
      diagnostic: { code: 'SCHEMA_PATCH', message: 'schema-patch', path: record.path, phase: 'patch' }
    })
    return this.view
  }

  reorder(parentId: string, from: number, to: number): CanvasReorderRecord {
    const parent = this.findById(parentId)
    if (!parent) throw new VarioError(`Missing parent ${parentId}`, ErrorCodes.SCHEMA_VALIDATION_ERROR)
    const children = Array.isArray(parent.node.children) ? [...parent.node.children] : []
    const [moved] = children.splice(from, 1)
    children.splice(to, 0, moved)
    const mutable = parent.node as SchemaNode & { children?: unknown }
    mutable.children = children
    this.revision += 1
    this.view = prepareView(this.root, { revision: this.revision })
    const movedId = (moved as SchemaNode & { id?: string }).id
      ?? [...(getPreparedSources(this.view)?.entries() ?? [])].find(([, node]) => node === moved)?.[0]
      ?? ''
    return { parentPath: parent.path, from, to, movedId }
  }

  node(id: string): PreparedNode | undefined {
    return this.view.nodes.get(id)
  }
}
