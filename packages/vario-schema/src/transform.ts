/**
 * defineSchema → 纯 Schema 转换器
 * 
 * 功能：
 * - 将 defineSchema API 转换为纯 Schema JSON
 * - 类型推导和类型安全
 * - 编译时转换（运行时只接受纯 Schema）
 * 
 * 遵循 TypeScript 最佳实践：
 * - 使用泛型支持类型推导
 * - 使用类型守卫
 * - 使用 readonly 确保不可变性
 */

import type {
  DefineSchemaConfig,
  VarioView,
  Schema,
  SchemaNode
} from './schema.types.js'
import type { MethodsRegistry, RuntimeContext } from '@vario/core'
import { createRuntimeContext } from '@vario/core'
import { validateSchema } from './validator.js'
import { SchemaValidationError } from './schema.types.js'
import { normalizeSchema } from './normalizer.js'

/**
 * defineSchema API
 * 
 * 将 TypeScript 配置转换为纯 Schema
 * 
 * @template TState 状态类型
 * @template TServices 服务类型
 * @param config defineSchema 配置
 * @returns VarioView（包含编译后的 Schema）
 * 
 * @example
 * ```typescript
 * const view = defineSchema({
 *   state: { count: 0 },
 *   schema({ state, $emit }) {
 *     return {
 *       type: 'div',
 *       children: [
 *         { type: 'Button', props: { label: 'Click' } }
 *       ]
 *     }
 *   }
 * })
 * ```
 */
/**
 * defineSchema 配置验证错误
 */
export class DefineSchemaConfigError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message)
    this.name = 'DefineSchemaConfigError'
  }
}

export function defineSchema<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TServices extends Record<string, (...args: unknown[]) => unknown> = Record<string, (...args: unknown[]) => unknown>
>(
  config: DefineSchemaConfig<TState, TServices>
): VarioView<TState> {
  // 1. 配置验证
  validateConfig(config)

  // 2. 创建临时运行时上下文（用于 schema 函数执行）
  const tempCtx = createRuntimeContext<TState>(config.state, {
    methods: registerServices(config.services)
  })

  // 3. 执行 schema 函数，获取 Schema
  let schema: Schema<TState>
  try {
    schema = config.schema(tempCtx)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new DefineSchemaConfigError(
      `Schema function execution failed: ${errorMessage}`,
      'schema'
    )
  }

  // 4. 验证 Schema
  try {
    validateSchema(schema)
  } catch (error: unknown) {
    if (error instanceof SchemaValidationError) {
      // 包装验证错误，提供更多上下文
      throw new DefineSchemaConfigError(
        `Schema validation failed at ${error.path}: ${error.message}`,
        'schema'
      )
    }
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new DefineSchemaConfigError(
      `Schema validation failed: ${errorMessage}`,
      'schema'
    )
  }

  // 5. 规范化 Schema
  const normalizedSchema = normalizeSchema(schema)

  // 6. 返回 VarioView
  return {
    schema: normalizedSchema,
    stateType: config.state,
    servicesType: config.services
  }
}

/**
 * 验证 defineSchema 配置
 */
function validateConfig<TState extends Record<string, unknown>>(
  config: unknown
): asserts config is DefineSchemaConfig<TState> {
  if (!config || typeof config !== 'object') {
    throw new DefineSchemaConfigError(
      'defineSchema config must be an object',
      'config'
    )
  }

  const cfg = config as Record<string, unknown>

  // 验证 state 字段
  if (!('state' in cfg)) {
    throw new DefineSchemaConfigError(
      'defineSchema config must have "state" field',
      'state'
    )
  }
  if (!cfg.state || typeof cfg.state !== 'object' || Array.isArray(cfg.state)) {
    throw new DefineSchemaConfigError(
      'defineSchema config "state" must be a non-empty object',
      'state'
    )
  }

  // 验证 schema 函数
  if (!('schema' in cfg)) {
    throw new DefineSchemaConfigError(
      'defineSchema config must have "schema" function',
      'schema'
    )
  }
  if (typeof cfg.schema !== 'function') {
    throw new DefineSchemaConfigError(
      'defineSchema config "schema" must be a function',
      'schema'
    )
  }

  // 验证 services（如果存在）
  if ('services' in cfg && cfg.services !== undefined) {
    if (typeof cfg.services !== 'object' || Array.isArray(cfg.services) || cfg.services === null) {
      throw new DefineSchemaConfigError(
        'defineSchema config "services" must be an object',
        'services'
      )
    }
    // 验证每个服务都是函数
    for (const [key, value] of Object.entries(cfg.services)) {
      if (typeof value !== 'function') {
        throw new DefineSchemaConfigError(
          `defineSchema config "services.${key}" must be a function`,
          `services.${key}`
        )
      }
    }
  }
}

/**
 * 注册服务到 $methods
 * 
 * 将 services 对象中的方法注册为 ctx.$methods['services.*']
 */
function registerServices<TServices extends Record<string, (...args: unknown[]) => unknown>>(
  services?: Readonly<TServices>
): MethodsRegistry {
  if (!services) {
    return {}
  }

  const methods: MethodsRegistry = {}

  for (const [serviceName, serviceFn] of Object.entries(services)) {
    // 注册为 services.* 格式
    // 服务函数需要包装为 MethodHandler 格式
    methods[`services.${serviceName}`] = async (_ctx: RuntimeContext, params: unknown) => {
      return await serviceFn(params)
    }
  }

  return methods
}

/**
 * 从 VarioView 提取纯 Schema
 * 
 * 用于运行时使用（Vue 渲染器等）
 * 
 * @param view VarioView
 * @returns 纯 Schema（可序列化为 JSON）
 */
export function extractSchema<TState extends Record<string, unknown>>(
  view: VarioView<TState>
): Schema<TState> {
  return view.schema
}

/**
 * 类型守卫：检查是否为有效的 Schema 节点
 */
export function isSchemaNode(value: unknown): value is SchemaNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  )
}
