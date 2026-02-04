/**
 * Runtime 模块导出
 */

export { createRuntimeContext } from './create-context.js'
export { createProxy } from './proxy.js'
export { createExpressionSandbox, isSafePropertyAccess } from './sandbox.js'
export {
  createLoopContext,
  releaseLoopContext,
  getLoopContextPool,
  clearLoopContextPool
} from './loop-context-pool.js'
export type { RuntimeContext } from '@variojs/types'

// 路径工具（供框架集成层使用）
export {
  parsePath,
  parsePathCached,
  clearPathCache,
  stringifyPath,
  getPathValue,
  setPathValue,
  matchPath,
  getParentPath,
  getLastSegment,
  type PathSegment
} from './path.js'

export { traverseSchema, type TraversalCallback } from './traversal.js'
