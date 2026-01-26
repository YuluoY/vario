/**
 * Schema 验证器
 * 
 * 功能：
 * - 结构验证（必需字段、类型检查）
 * - 表达式安全验证（使用 vario-core 的表达式系统）
 * - 路径验证（model, loop.items 等）
 * - 递归校验
 * - 详细错误信息（路径、原因、修复建议）
 * 
 * 遵循 TypeScript 最佳实践：
 * - 使用类型守卫
 * - 使用 readonly 确保不可变性
 * - 使用联合类型
 */

import type { SchemaNode, LoopConfig } from './schema.types.js'
import { SchemaValidationError } from './schema.types.js'
import { parseExpression, validateAST } from '@variojs/core'

/**
 * 验证选项
 */
export interface ValidationOptions {
  /** 是否验证表达式（默认 true） */
  validateExpressions?: boolean
  /** 是否验证路径（默认 true） */
  validatePaths?: boolean
  /** 自定义验证器 */
  customValidators?: Array<(node: SchemaNode, path: string) => void>
}

/**
 * 验证 Schema 节点
 * 
 * @param node Schema 节点
 * @param path 当前路径（用于错误报告）
 * @param options 验证选项
 * @throws SchemaValidationError 如果验证失败
 */
export function validateSchemaNode(
  node: unknown,
  path: string = 'root',
  options: ValidationOptions = {}
): asserts node is SchemaNode {
  const {
    validateExpressions = true,
    validatePaths = true,
    customValidators = []
  } = options
  if (!isObject(node)) {
    throw new SchemaValidationError(
      path,
      'Schema node must be an object',
      'INVALID_NODE_TYPE'
    )
  }

  // 验证 type 字段（必需）
  if (typeof node.type !== 'string' || node.type.length === 0) {
    throw new SchemaValidationError(
      path,
      'Schema node must have a non-empty "type" field',
      'MISSING_TYPE'
    )
  }

  // 验证 props（如果存在）
  if (node.props !== undefined) {
    if (!isObject(node.props)) {
      throw new SchemaValidationError(
        `${path}.props`,
        'Props must be an object',
        'INVALID_PROPS_TYPE'
      )
    }
  }

  // 验证 children（如果存在）
  if (node.children !== undefined) {
    if (typeof node.children === 'string') {
      // 字符串子节点：验证表达式（如果包含插值）
      if (validateExpressions && node.children.includes('{{')) {
        validateExpression(node.children, `${path}.children`)
      }
    } else if (Array.isArray(node.children)) {
      // 数组子节点：递归验证每个子节点
      node.children.forEach((child, index) => {
        validateSchemaNode(child, `${path}.children[${index}]`, options)
      })
    } else {
      throw new SchemaValidationError(
        `${path}.children`,
        'Children must be a string or an array of SchemaNode',
        'INVALID_CHILDREN_TYPE'
      )
    }
  }

  // 验证 events（如果存在）
  if (node.events !== undefined) {
    if (!isObject(node.events)) {
      throw new SchemaValidationError(
        `${path}.events`,
        'Events must be an object',
        'INVALID_EVENTS_TYPE'
      )
    }

    for (const [eventName, instructions] of Object.entries(node.events)) {
      if (!Array.isArray(instructions)) {
        throw new SchemaValidationError(
          `${path}.events.${eventName}`,
          'Event handler must be an array of instructions',
          'INVALID_EVENT_HANDLER_TYPE'
        )
      }

      // 验证每个动作
      instructions.forEach((action, index) => {
        if (!isObject(action) || typeof action.type !== 'string') {
          throw new SchemaValidationError(
            `${path}.events.${eventName}[${index}]`,
            'Action must be an object with "type" field',
            'INVALID_ACTION'
          )
        }
      })
    }
  }

  // 验证 cond（如果存在）
  if (node.cond !== undefined) {
    if (typeof node.cond !== 'string') {
      throw new SchemaValidationError(
        `${path}.cond`,
        'Condition must be a string expression',
        'INVALID_COND_TYPE'
      )
    }
    if (validateExpressions) {
      validateExpression(node.cond, `${path}.cond`)
    }
  }

  // 验证 show（如果存在）
  if (node.show !== undefined) {
    if (typeof node.show !== 'string') {
      throw new SchemaValidationError(
        `${path}.show`,
        'Show must be a string expression',
        'INVALID_SHOW_TYPE'
      )
    }
    if (validateExpressions) {
      validateExpression(node.show, `${path}.show`)
    }
  }

  // 验证 loop（如果存在）
  if (node.loop !== undefined) {
    validateLoopConfig(node.loop, `${path}.loop`, options)
  }

  // 验证 model（如果存在）：string 或 { path: string, scope?: boolean }
  if (node.model !== undefined) {
    if (typeof node.model === 'string') {
      if (validatePaths) validatePath(node.model, `${path}.model`)
    } else if (typeof node.model === 'object' && node.model !== null && !Array.isArray(node.model)) {
      const m = node.model as Record<string, unknown>
      if (typeof m.path !== 'string' || m.path.length === 0) {
        throw new SchemaValidationError(
          `${path}.model.path`,
          'Model scope must have a non-empty string path',
          'INVALID_MODEL_SCOPE_PATH'
        )
      }
      if (m.scope !== undefined && typeof m.scope !== 'boolean') {
        throw new SchemaValidationError(
          `${path}.model.scope`,
          'Model scope must be a boolean when present',
          'INVALID_MODEL_SCOPE'
        )
      }
      if (validatePaths) validatePath(m.path, `${path}.model.path`)
    } else {
      throw new SchemaValidationError(
        `${path}.model`,
        'Model must be a string path or { path: string, scope?: boolean }',
        'INVALID_MODEL_TYPE'
      )
    }
  }

  // 验证 props 中的表达式（如果存在）
  if (node.props && validateExpressions) {
    validatePropsExpressions(node.props, `${path}.props`)
  }

  // 执行自定义验证器
  // 此时 node 已经被断言为 SchemaNode（通过 asserts）
  // 使用 unknown 作为中间类型以确保类型安全
  const validatedNode = node as unknown as SchemaNode
  for (const validator of customValidators) {
    validator(validatedNode, path)
  }
}

/**
 * 验证 props 中的表达式
 */
function validatePropsExpressions(
  props: Record<string, unknown>,
  path: string
): void {
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' && value.includes('{{')) {
      validateExpression(value, `${path}.${key}`)
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // 递归验证嵌套对象
      validatePropsExpressions(value as Record<string, unknown>, `${path}.${key}`)
    } else if (Array.isArray(value)) {
      // 验证数组中的表达式
      value.forEach((item, index) => {
        if (typeof item === 'string' && item.includes('{{')) {
          validateExpression(item, `${path}.${key}[${index}]`)
        }
      })
    }
  }
}

/**
 * 验证循环配置
 */
function validateLoopConfig(
  loop: unknown,
  path: string,
  options: ValidationOptions = {}
): asserts loop is LoopConfig {
  if (!isObject(loop)) {
    throw new SchemaValidationError(
      path,
      'Loop config must be an object',
      'INVALID_LOOP_TYPE'
    )
  }

  // 验证 items（必需）
  if (typeof loop.items !== 'string' || loop.items.length === 0) {
    throw new SchemaValidationError(
      `${path}.items`,
      'Loop items must be a non-empty string path',
      'MISSING_LOOP_ITEMS'
    )
  }
  if (options.validatePaths !== false) {
    validatePath(loop.items, `${path}.items`)
  }

  // 验证 itemKey（必需）
  if (typeof loop.itemKey !== 'string' || loop.itemKey.length === 0) {
    throw new SchemaValidationError(
      `${path}.itemKey`,
      'Loop itemKey must be a non-empty string',
      'MISSING_LOOP_ITEM_KEY'
    )
  }

  // 验证 indexKey（可选）
  if (loop.indexKey !== undefined) {
    if (typeof loop.indexKey !== 'string' || loop.indexKey.length === 0) {
      throw new SchemaValidationError(
        `${path}.indexKey`,
        'Loop indexKey must be a non-empty string',
        'INVALID_LOOP_INDEX_KEY'
      )
    }
  }
}

/**
 * 验证表达式
 * 
 * 使用 vario-core 的表达式系统进行安全验证
 */
function validateExpression(expr: string, path: string): void {
  try {
    // 提取表达式（如果包含插值语法）
    let actualExpr = expr
    if (expr.includes('{{')) {
      // 提取 {{ ... }} 中的表达式
      const matches = expr.match(/\{\{([^}]+)\}\}/g)
      if (matches) {
        for (const match of matches) {
          const innerExpr = match.slice(2, -2).trim()
          if (innerExpr.length === 0) {
            throw new SchemaValidationError(
              path,
              'Expression cannot be empty',
              'EMPTY_EXPRESSION',
              {
                suggestion: 'Remove empty expression or provide a valid expression'
              }
            )
          }
          const ast = parseExpression(innerExpr)
          validateAST(ast)
        }
        return
      }
    }

    // 直接验证表达式
    if (actualExpr.length === 0) {
      throw new SchemaValidationError(
        path,
        'Expression cannot be empty',
        'EMPTY_EXPRESSION',
        {
          suggestion: 'Provide a valid expression or remove the field'
        }
      )
    }
    const ast = parseExpression(actualExpr)
    validateAST(ast)
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : String(error)
    const suggestion = getExpressionErrorSuggestion(errorMessage)
    throw new SchemaValidationError(
      path,
      `Invalid expression: ${errorMessage}`,
      'INVALID_EXPRESSION',
      {
        expression: expr,
        suggestion
      }
    )
  }
}

/**
 * 获取表达式错误的修复建议
 */
function getExpressionErrorSuggestion(errorMessage: string): string | undefined {
  if (errorMessage.includes('not in whitelist')) {
    return 'Use only whitelisted functions. Check documentation for allowed functions.'
  }
  if (errorMessage.includes('unsafe')) {
    return 'Expression contains unsafe access. Use only state properties and whitelisted functions.'
  }
  if (errorMessage.includes('parse')) {
    return 'Check expression syntax. Ensure all brackets and operators are properly closed.'
  }
  return undefined
}

/**
 * 验证路径
 * 
 * 路径必须是有效的标识符路径（如 "user.name", "items.0"）
 */
function validatePath(path: string, errorPath: string): void {
  // 路径不能为空
  if (path.length === 0) {
    throw new SchemaValidationError(
      errorPath,
      'Path cannot be empty',
      'EMPTY_PATH'
    )
  }

  // 路径不能以 $ 或 _ 开头（系统 API 保留）
  if (path.startsWith('$') || path.startsWith('_')) {
    throw new SchemaValidationError(
      errorPath,
      `Path "${path}" cannot start with "$" or "_" (reserved for system APIs)`,
      'RESERVED_PATH'
    )
  }

  // 路径必须是有效的标识符路径
  const pathPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*|\.[0-9]+)*$/
  if (!pathPattern.test(path)) {
    throw new SchemaValidationError(
      errorPath,
      `Invalid path format: "${path}"`,
      'INVALID_PATH_FORMAT'
    )
  }
}

/**
 * 类型守卫：检查是否为对象
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 验证整个 Schema
 * 
 * @param schema Schema 根节点
 * @param options 验证选项
 * @throws SchemaValidationError 如果验证失败
 */
export function validateSchema(
  schema: unknown,
  options: ValidationOptions = {}
): asserts schema is SchemaNode {
  validateSchemaNode(schema, 'root', options)
}

/**
 * 验证 Schema 并返回详细结果
 * 
 * @param schema Schema 根节点
 * @param options 验证选项
 * @returns 验证结果
 */
export function validateSchemaWithResult(
  schema: unknown,
  options: ValidationOptions = {}
): {
  valid: boolean
  errors: SchemaValidationError[]
} {
  const errors: SchemaValidationError[] = []
  
  try {
    validateSchema(schema, options)
    return { valid: true, errors: [] }
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      errors.push(error)
    } else {
      errors.push(new SchemaValidationError(
        'root',
        error instanceof Error ? error.message : String(error),
        'VALIDATION_ERROR'
      ))
    }
    return { valid: false, errors }
  }
}
