/**
 * Error 相关类型定义
 */

/**
 * 错误上下文接口
 */
export interface ErrorContext {
  /** 错误发生的路径 */
  path?: string
  /** 表达式字符串（如果是表达式错误） */
  expression?: string
  /** Action 对象（如果是 Action 错误） */
  action?: Record<string, unknown>
  /** 修复建议 */
  suggestion?: string
  /** 额外上下文信息 */
  metadata?: Record<string, unknown>
}

/**
 * Schema 验证错误上下文
 */
export interface SchemaValidationErrorContext {
  /** 表达式字符串（如果是表达式错误） */
  expression?: string
  /** 修复建议 */
  suggestion?: string
  /** 额外上下文信息 */
  metadata?: Record<string, unknown>
}
