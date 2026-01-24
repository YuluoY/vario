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
  getLastSegment
} from './runtime/index.js'
export type { RuntimeContext } from './types.js'
export type { PathSegment } from './runtime/path.js'
export type { CreateContextOptions } from './runtime/create-context.js'

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
  type ErrorContext,
  type ErrorCode
} from './errors.js'
export type { 
  Action, 
  ActionMap,
  ActionHandler,
  ExpressionCache, 
  MethodsRegistry, 
  ExpressionOptions 
} from './types.js'
