/**
 * Vario 错误处理体系
 * 
 * 统一的错误基类和错误码系统
 */

import type { Action } from '@variojs/types'

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  /** Schema 路径（如 "events.click[0]"） */
  schemaPath?: string
  /** 表达式字符串 */
  expression?: string
  /** 动作对象 */
  action?: Action
  /** 调用栈（简化版） */
  stack?: string[]
  /** 额外上下文信息 */
  metadata?: Record<string, unknown>
}

/**
 * Vario 错误基类
 * 
 * 所有 Vario 相关错误都应继承此类
 */
export class VarioError extends Error {
  /** 错误码 */
  public readonly code: string
  /** 错误上下文 */
  public readonly context: ErrorContext

  constructor(
    message: string,
    code: string,
    context: ErrorContext = {}
  ) {
    super(message)
    this.name = 'VarioError'
    this.code = code
    this.context = context
    
    // 确保 stack 属性存在
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VarioError)
    }
  }

  /**
   * 获取友好的错误消息
   */
  getFriendlyMessage(): string {
    const parts: string[] = [this.message]
    
    if (this.context.schemaPath) {
      parts.push(`\n  Schema 路径: ${this.context.schemaPath}`)
    }
    
    if (this.context.expression) {
      parts.push(`\n  表达式: ${this.context.expression}`)
    }
    
    if (this.context.action) {
      parts.push(`\n  动作类型: ${this.context.action.type}`)
    }
    
    return parts.join('')
  }

  /**
   * 转换为 JSON（用于序列化）
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack
    }
  }
}

/**
 * 动作执行错误
 */
export class ActionError extends VarioError {
  constructor(
    action: Action,
    message: string,
    code: string = 'ACTION_ERROR',
    context: Omit<ErrorContext, 'action'> = {}
  ) {
    super(message, code, {
      ...context,
      action
    })
    this.name = 'ActionError'
  }
}

/**
 * 表达式求值错误
 */
export class ExpressionError extends VarioError {
  constructor(
    expression: string,
    message: string,
    code: string = 'EXPRESSION_ERROR',
    context: Omit<ErrorContext, 'expression'> = {}
  ) {
    super(message, code, {
      ...context,
      expression
    })
    this.name = 'ExpressionError'
  }
}

/**
 * 服务调用错误
 */
export class ServiceError extends VarioError {
  public readonly service: string
  public readonly originalError?: Error

  constructor(
    service: string,
    message: string,
    originalError?: Error,
    context: ErrorContext = {}
  ) {
    super(message, 'SERVICE_ERROR', context)
    this.name = 'ServiceError'
    this.service = service
    this.originalError = originalError
  }
}

/**
 * 批量执行错误
 */
export class BatchError extends VarioError {
  public readonly failedActions: Array<{ action: Action; error: Error }>

  constructor(
    failedActions: Array<{ action: Action; error: Error }>,
    message: string,
    context: ErrorContext = {}
  ) {
    super(message, 'BATCH_ERROR', context)
    this.name = 'BatchError'
    this.failedActions = failedActions
  }
}

/**
 * 错误码定义
 */
export const ErrorCodes = {
  // 动作相关错误
  ACTION_UNKNOWN_TYPE: 'ACTION_UNKNOWN_TYPE',
  ACTION_EXECUTION_ERROR: 'ACTION_EXECUTION_ERROR',
  ACTION_ABORTED: 'ACTION_ABORTED',
  ACTION_TIMEOUT: 'ACTION_TIMEOUT',
  ACTION_MAX_STEPS_EXCEEDED: 'ACTION_MAX_STEPS_EXCEEDED',
  ACTION_MISSING_PARAM: 'ACTION_MISSING_PARAM',
  ACTION_INVALID_PARAM: 'ACTION_INVALID_PARAM',
  
  // 表达式相关错误
  EXPRESSION_PARSE_ERROR: 'EXPRESSION_PARSE_ERROR',
  EXPRESSION_VALIDATION_ERROR: 'EXPRESSION_VALIDATION_ERROR',
  EXPRESSION_EVALUATION_ERROR: 'EXPRESSION_EVALUATION_ERROR',
  EXPRESSION_TIMEOUT: 'EXPRESSION_TIMEOUT',
  EXPRESSION_MAX_STEPS_EXCEEDED: 'EXPRESSION_MAX_STEPS_EXCEEDED',
  EXPRESSION_UNSAFE_ACCESS: 'EXPRESSION_UNSAFE_ACCESS',
  EXPRESSION_FUNCTION_NOT_WHITELISTED: 'EXPRESSION_FUNCTION_NOT_WHITELISTED',
  
  // 服务相关错误
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  SERVICE_CALL_ERROR: 'SERVICE_CALL_ERROR',
  
  // 批量执行错误
  BATCH_ERROR: 'BATCH_ERROR',
  
  // Schema 相关错误
  SCHEMA_VALIDATION_ERROR: 'SCHEMA_VALIDATION_ERROR',
  SCHEMA_INVALID_ACTION: 'SCHEMA_INVALID_ACTION',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]
