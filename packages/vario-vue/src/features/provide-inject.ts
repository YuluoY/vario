/**
 * Provide/Inject 支持
 * 
 * 在 Schema 节点上支持 Vue 的依赖注入系统
 * 
 * 特性：
 * - provide: 向下传递数据给子组件
 * - inject: 从父组件获取数据
 * - 支持表达式求值：provide 的值可以是表达式
 * - 支持默认值：inject 可以指定默认值
 */

import { provide, inject, type InjectionKey } from 'vue'
import type { RuntimeContext } from '@variojs/types'
import { evaluate } from '@variojs/core'
import type { VueSchemaNode } from '../types.js'

/**
 * Inject 配置（规范化后）
 */
interface NormalizedInjectConfig {
  localKey: string
  from: string | InjectionKey<any>
  defaultValue?: any
  hasDefault: boolean
}

/**
 * 判断字符串是否看起来像一个表达式
 * 表达式通常包含：变量名（无空格/引号）、点号访问、运算符等
 */
function looksLikeExpression(str: string): boolean {
  // 纯字母数字下划线的简单标识符可能是状态引用
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str)) {
    return true
  }
  // 包含点号访问：user.name
  if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(str)) {
    return true
  }
  // 包含运算符的表达式
  if (/[+\-*/%<>=!&|?:]/.test(str)) {
    return true
  }
  return false
}

/**
 * 处理 provide 配置
 * 在组件 setup 中调用，向下传递数据
 * 
 * @param schema Schema 节点
 * @param ctx 运行时上下文
 */
export function setupProvide(
  schema: VueSchemaNode,
  ctx: RuntimeContext
): void {
  if (!schema.provide || Object.keys(schema.provide).length === 0) {
    return
  }

  for (const [key, value] of Object.entries(schema.provide)) {
    let resolvedValue: any
    
    // 如果值是字符串且看起来像表达式，尝试求值
    if (typeof value === 'string' && looksLikeExpression(value)) {
      try {
        const result = evaluate(value, ctx)
        // 只有当结果不是 undefined 时才使用求值结果
        resolvedValue = result !== undefined ? result : value
      } catch {
        // 表达式求值失败，使用原始字符串
        resolvedValue = value
      }
    } else {
      resolvedValue = value
    }
    
    provide(key, resolvedValue)
  }
}

/**
 * 规范化 inject 配置
 */
function normalizeInjectConfig(
  injectDef: VueSchemaNode['inject']
): NormalizedInjectConfig[] {
  if (!injectDef) return []
  
  const configs: NormalizedInjectConfig[] = []
  
  if (Array.isArray(injectDef)) {
    // 数组形式: ['theme', 'locale']
    for (const key of injectDef) {
      configs.push({
        localKey: key,
        from: key,
        hasDefault: false
      })
    }
  } else {
    // 对象形式
    for (const [localKey, config] of Object.entries(injectDef)) {
      if (typeof config === 'string') {
        // 简单映射: { myTheme: 'theme' }
        configs.push({
          localKey,
          from: config,
          hasDefault: false
        })
      } else {
        // 完整配置: { myTheme: { from: 'theme', default: 'light' } }
        configs.push({
          localKey,
          from: config.from || localKey,
          defaultValue: config.default,
          hasDefault: 'default' in config
        })
      }
    }
  }
  
  return configs
}

/**
 * 处理 inject 配置
 * 在组件 setup 中调用，从父组件获取数据
 * 
 * @param schema Schema 节点
 * @returns inject 的值对象，可合并到 props 或 attrs
 */
export function setupInject(
  schema: VueSchemaNode
): Record<string, any> {
  const configs = normalizeInjectConfig(schema.inject)
  if (configs.length === 0) {
    return {}
  }

  const result: Record<string, any> = {}
  
  for (const config of configs) {
    const { localKey, from, defaultValue, hasDefault } = config
    
    // 使用 Vue 的 inject 获取值
    const value = hasDefault 
      ? inject(from as string, defaultValue)
      : inject(from as string)
    
    result[localKey] = value
  }
  
  return result
}

/**
 * 在 setup 中同时处理 provide 和 inject
 * 
 * @param schema Schema 节点
 * @param ctx 运行时上下文
 * @returns inject 的值对象
 */
export function setupProvideInject(
  schema: VueSchemaNode,
  ctx: RuntimeContext
): Record<string, any> {
  setupProvide(schema, ctx)
  return setupInject(schema)
}
