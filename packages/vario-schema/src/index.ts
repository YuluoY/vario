/**
 * @variojs/schema - Vario Schema DSL
 * 
 * 提供：
 * - Schema DSL 类型定义
 * - Schema 验证器
 * - Schema 规范化器
 * - defineSchema API（TypeScript 原生 API）
 */

// 类型导出
export type {
  SchemaNode,
  Schema,
  LoopConfig,
  ModelScopeConfig,
  DefineSchemaConfig,
  VarioView,
  InferStateType,
  InferStateFromConfig,
  InferServicesFromConfig,
  DirectiveConfig,
  DirectiveObject,
  DirectiveArray
} from './schema.types.js'

// 错误类型
export { SchemaValidationError } from './schema.types.js'
export type { SchemaValidationErrorContext } from './schema.types.js'

// 验证器
export { 
  validateSchema, 
  validateSchemaNode,
  validateSchemaWithResult
} from './validator.js'
export type { ValidationOptions } from './validator.js'

// 规范化器
export { 
  normalizeSchema, 
  normalizeSchemaNode,
  clearNormalizationCache
} from './normalizer.js'

export { normalizeEventHandler, isCallShorthand } from './event-handler.js'
export { validateActionPayload } from './action-contract.js'
export type { ActionValidationIssue } from './action-contract.js'

// 转换器
export {
  defineSchema,
  extractSchema,
  isSchemaNode,
  DefineSchemaConfigError
} from './transform.js'

export { traverseIterative } from './compiler/traverse-iterative.js'
export { prepareView, getPreparedSources, bindPreparedSources, listPreparedNodes } from './compiler/prepare-view.js'
export type { PrepareViewOptions } from './compiler/prepare-view.js'
export { buildPrepareIndex } from './compiler/prepare-index.js'
export { classifyRegion, groupMaximalRegions } from './compiler/prepare-node.js'
export { EVENT_MODIFIERS, assertSupportedModifiers } from './compiler/event-modifiers.js'
export { serializeSchema, parseSchema, type SchemaDocument } from './codec/index.js'
export { migrateToV1, rollbackToV0, migrateIdempotent, describeDocument, wrapLegacy } from './migrations/index.js'
export { recompileIncremental } from './compiler/incremental/index.js'
export { validateMaterialManifest, type MaterialManifest } from './material-manifest.js'
export { CanvasWorkspace } from './canvas/workspace.js'
export type { CanvasPatchRecord, CanvasReorderRecord } from './canvas/workspace.js'
