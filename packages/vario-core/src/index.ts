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
  invalidateCache,
  clearCache,
  getCacheStats
} from './expression/index.js'

// VM
export {
  execute,
  registerBuiltinMethods
} from './vm/index.js'
export type { ExecuteOptions } from './vm/index.js'
export {
  ActionError,
  ExpressionError,
  ServiceError,
  BatchError,
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

export type { 
  Action,
  ActionMap,
  ExpressionCache, 
  ExpressionOptions,
  ErrorContext
} from '@variojs/types'
