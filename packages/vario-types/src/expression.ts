/**
 * Expression 相关类型定义
 */

/**
 * 表达式求值选项
 */
export interface ExpressionOptions {
  /**
   * 是否允许访问全局对象（默认 false）
   */
  allowGlobals?: boolean
  /**
   * 最大求值步数
   */
  maxSteps?: number
  /**
   * 求值超时（毫秒）
   */
  timeout?: number
  /**
   * 最大嵌套深度（防止 DoS 攻击，默认 50）
   */
  maxNestingDepth?: number
}

/**
 * 表达式缓存接口
 * 结果类型使用 unknown，因为表达式求值结果类型无法静态推导
 */
export interface ExpressionCache {
  expr: string
  result: unknown  // 表达式求值结果，类型无法静态推导
  dependencies: string[]  // 支持通配符：['items.*', 'user.name']
  timestamp: number
}
