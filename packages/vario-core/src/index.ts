/**
 * @variojs/core - Vario Core Runtime
 * 
 * 核心运行时模块，包含：
 * - RuntimeContext: 扁平化状态 + $ 前缀系统 API
 * - Expression System: 安全表达式求值
 * - Action VM: 动作虚拟机
 * - Path Utilities: 统一的路径解析工具
 */

// Runtime
export {
  createRuntimeContext,
  createProxy,
  createExpressionSandbox,
  isSafePropertyAccess,
  // 循环上下文（供框架集成层使用）
  createLoopContext,
  releaseLoopContext,
  // 转发/作用域上下文原语
  createForwardingContext,
  getParentContext,
  createScopeContext,
  isScopeContext,
  // 路径工具（供框架集成层使用）
  parsePath,
  parsePathCached,
  clearPathCache,
  stringifyPath,
  getPathValue,
  setPathValue,
  matchPath,
  getParentPath,
  getLastSegment,
  traverseSchema,
  type TraversalCallback
} from './runtime/index.js'
export type { 
  RuntimeContext, 
  CreateContextOptions, 
  MethodsRegistry,
  MethodHandler,
  ActionHandler 
} from '@variojs/types'
export type { PathSegment } from '@variojs/types'

// Expression
export {
  parseExpression,
  validateAST,
  evaluateExpression,
  evaluate,
  extractExpression,
  extractDependencies,
  getCachedExpression,
  setCachedExpression,
  lookupCachedExpression,
  invalidateCache,
  clearCache,
  getCacheStats,
  compileExpressionPlan,
  compileExpressionPlanUncached,
  getCachedExpressionPlan,
  getPlanCacheStats,
  ResultMemo,
  evaluateExpressionPlan
} from './expression/index.js'
export { registerCapability, getCapability, listCapabilities } from './expression/policy.js'
export { createDiagnosticSink, noopDiagnosticSink } from './diagnostics/diagnostic-sink.js'
export type { DiagnosticSink, DiagnosticEvent } from './diagnostics/diagnostic-sink.js'
export {
  createScopeFrame,
  lookupBinding,
  releaseScopeFrame
} from './scope/index.js'
export type { ScopeFrame, ScopeTable } from './scope/index.js'
export {
  subscribeChangeSet,
  beginChangeTransaction,
  endChangeTransaction,
  recordChange,
  flushChangeSet
} from './runtime/change-set.js'
export { RuntimeSession, getOrCreateEngine, registerEngineMaterial, getEngineMaterial } from './runtime/runtime-session.js'
export { StateStore } from './state/index.js'
export { PageSessionManager } from './runtime/page-session-manager.js'

// VM
export {
  execute,
  runChild,
  registerBuiltinMethods
} from './vm/index.js'
export type { ExecuteOptions } from './vm/index.js'
export { unbindExecutionSession, getExecutionSession, bindExecutionSession, createExecutionSession } from './vm/execution-session.js'
export type { ExecutionSession } from './vm/execution-session.js'
export {
  ActionError,
  ExpressionError,
  ServiceError,
  BatchError,
  PathWriteError,
  SchemaDepthError,
  VarioError,
  ErrorCodes,
  type ErrorCode
} from './errors.js'

// Schema utilities
export {
  analyzeSchema,
  findNodes,
  findNode,
  findPathById,
  createQueryEngine,
  type SchemaStats,
  type SchemaIndex,
  type AnalysisResult,
  type QueryEngineOptions,
  type NodeResult
} from './schema/index.js'
export {
  scanSchemaIterative,
  DEFAULT_MOUNT_MAX_DEPTH,
  DEFAULT_SCAN_MAX_DEPTH,
  type SchemaScanResult
} from './schema/scan.js'

export type { 
  Action,
  ActionMap,
  ExpressionCache, 
  ExpressionOptions,
  ErrorContext
} from '@variojs/types'
