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

// 转换器
export {
  defineSchema,
  extractSchema,
  isSchemaNode,
  DefineSchemaConfigError
} from './transform.js'
