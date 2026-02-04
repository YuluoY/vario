/**
 * Vario Schema DSL 类型定义
 * 
 * 从 @variojs/types 重新导出核心类型
 */

// 从 @variojs/types 重新导出所有 Schema 相关类型
export type {
  SchemaNode,
  Schema,
  ModelScopeConfig,
  ModelModifiers,
  LoopConfig,
  DefineSchemaConfig,
  VarioView,
  EventHandler,
  EventHandlerArray,
  EventModifier,
  EventModifiers,
  EventName,
  CommonEventName,
  DirectiveConfig,
  DirectiveObject,
  DirectiveArray,
  InferStateType,
  InferStateFromConfig,
  InferServicesFromConfig
} from '@variojs/types'

// 从 @variojs/types 导入错误上下文类型
export type { SchemaValidationErrorContext } from '@variojs/types'

/**
 * Schema 验证错误
 */
export class SchemaValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
    public readonly code?: string,
    public readonly context?: import('@variojs/types').SchemaValidationErrorContext
  ) {
    super(message)
    this.name = 'SchemaValidationError'
  }

  /**
   * 获取友好的错误消息（包含修复建议）
   */
  getFriendlyMessage(): string {
    const parts: string[] = [this.message]
    
    if (this.path !== 'root') {
      parts.push(`\n  路径: ${this.path}`)
    }
    
    if (this.context?.expression) {
      parts.push(`\n  表达式: ${this.context.expression}`)
    }
    
    if (this.context?.suggestion) {
      parts.push(`\n  建议: ${this.context.suggestion}`)
    }
    
    return parts.join('')
  }
}
