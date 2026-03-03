import { computed, type ComputedRef } from 'vue'
import type { Schema, SchemaNode } from '@variojs/schema'
import { registerModelConfig } from '../../bindings.js'

/**
 * 解析 schema 入参为稳定的 ComputedRef
 *
 * 支持三种输入：
 * - 直接对象 schema
 * - 工厂函数 () => schema
 * - 已有 ComputedRef<schema>
 */
export function resolveSchema<TState extends Record<string, unknown>>(
  schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>
): ComputedRef<Schema<TState>> {
  if (typeof schema === 'function') {
    return computed(() => {
      const result = (schema as () => Schema<TState>)()
      if (result && typeof result === 'object' && 'value' in result && 'effect' in result) {
        return (result as unknown as ComputedRef<Schema<TState>>).value
      }
      return result
    })
  }

  if (schema && typeof schema === 'object' && 'value' in schema && 'effect' in schema) {
    return schema as ComputedRef<Schema<TState>>
  }

  return computed(() => schema as Schema<TState>)
}

/**
 * 校验当前 schema 是否为可渲染节点
 */
export function isValidSchema(schema: unknown): schema is SchemaNode {
  return schema != null && typeof schema === 'object' && 'type' in (schema as object)
}

/**
 * 深度比较两个值是否相等
 *
 * 用于 computed 同步时避免无意义 _set 调用。
 */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => isDeepEqual(item, b[index]))
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => isDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  }

  return false
}

/**
 * 规范化 modelOptions 配置
 */
export function normalizeModelOptions(
  config?: { separator?: string; lazy?: boolean }
): { separator: string; lazy?: boolean } {
  return {
    separator: config?.separator ?? '.',
    lazy: config?.lazy
  }
}

/**
 * 应用外部传入的 model 绑定协议
 *
 * 支持：
 * - `CompName`
 * - `CompName:modelName`
 */
export function applyBindingConfigs(bindings?: Record<string, any>): void {
  if (!bindings) return
  Object.entries(bindings).forEach(([key, config]) => {
    if (!config) return
    if (key.includes(':')) {
      const [component, modelName] = key.split(':')
      registerModelConfig(component, config, modelName)
    } else {
      registerModelConfig(key, config)
    }
  })
}
