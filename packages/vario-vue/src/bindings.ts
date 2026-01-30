/**
 * Bidirectional binding handlers for Vue integration
 * 
 * 功能：
 * - v-model 双向绑定处理
 * - 智能检测组件类型（原生元素 vs Vue 组件）
 * - 自动适配不同的 model 协议（Vue 3 标准 vs 传统协议）
 * - 支持自定义配置（可选）
 * 
 * 设计原则：
 * - 使用 vario-core 的路径工具，避免重复代码
 * - 优先自动检测，减少配置需求
 * - 支持 Vue 3 和传统协议
 */

import { resolveComponent } from 'vue'
import type { RuntimeContext } from '@variojs/core'
import { getPathValue } from '@variojs/core'

/**
 * 组件 model 配置
 */
export interface ModelConfig {
  /** 值属性名（如 modelValue, value） */
  prop: string
  /** 更新事件名（如 update:modelValue, input, change） */
  event: string
}

/**
 * 自定义配置注册表
 */
const customConfigs = new Map<string, ModelConfig>()

/**
 * 原生表单元素
 */
const NATIVE_FORM_ELEMENTS = new Set(['input', 'textarea', 'select'])

/**
 * 原生元素的事件映射
 */
const NATIVE_EVENT_MAP: Record<string, string> = {
  input: 'input',
  textarea: 'input',
  select: 'change'
}

/**
 * Vue 3 标准 model 配置
 */
const VUE3_DEFAULT_CONFIG: ModelConfig = {
  prop: 'modelValue',
  event: 'update:modelValue'
}

/**
 * 获取组件的 model 配置
 */
function getModelConfig(componentType: string, component?: unknown): ModelConfig {
  // 1. 自定义配置优先
  const custom = customConfigs.get(componentType)
  if (custom) return custom
  
  // 2. 原生表单元素
  const lowerType = componentType.toLowerCase()
  if (NATIVE_FORM_ELEMENTS.has(lowerType)) {
    return {
      prop: 'value',
      event: NATIVE_EVENT_MAP[lowerType] || 'input'
    }
  }
  
  // 3. 尝试从组件定义检测
  if (component && typeof component === 'object') {
    const comp = component as Record<string, unknown>
    const props = (comp.props || comp.__props || {}) as Record<string, unknown>
    
    // 检查 modelValue（Vue 3 标准）
    if ('modelValue' in props || comp.__vModel) {
      return VUE3_DEFAULT_CONFIG
    }
    
    // 检查 value（传统协议）
    if ('value' in props) {
      const emits = (comp.emits || comp.__emits || []) as string[]
      return {
        prop: 'value',
        event: emits.includes('update:value') ? 'update:value' : 'input'
      }
    }
  }
  
  // 4. 默认 Vue 3 标准
  return VUE3_DEFAULT_CONFIG
}

/**
 * 转换事件名为 Vue 事件处理器格式
 */
function toEventHandlerName(event: string): string {
  if (event.startsWith('update:')) {
    return `onUpdate:${event.slice(7)}`
  }
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`
}

/**
 * 获取默认值（当值为 undefined 时）
 * 确保双向绑定能够正常工作，即使状态中还没有这个字段
 */
function getDefaultValue(prop: string): unknown {
  // 对于输入框相关的 prop，默认为空字符串
  if (prop === 'value' || prop === 'modelValue') {
    return ''
  }
  // 对于复选框相关的 prop，默认为 false
  if (prop === 'checked') {
    return false
  }
  // 其他情况返回 undefined，让组件自己处理
  return undefined
}

/**
 * 创建双向绑定配置
 * 
 * @param componentType 组件类型名
 * @param modelPath 模型路径（如 "user.name"）
 * @param ctx 运行时上下文
 * @param component 组件对象（可选，用于自动检测）
 * @param getState 获取响应式状态的函数（用于 Vue 响应式追踪）
 * @param modelName 具名 model（可选，如 "checked", "value"）
 * @param schemaDefault 当状态未初始化时使用的默认值（来自 schema model.default）
 * @param schemaLazy true 时不预写 state，仅当用户修改该绑定值后才写入 state
 * @returns 包含 prop 和 event handler 的对象
 */
export function createModelBinding(
  componentType: string,
  modelPath: string,
  ctx: RuntimeContext,
  component?: unknown,
  getState?: () => Record<string, unknown>,
  modelName?: string,
  schemaDefault?: unknown,
  schemaLazy?: boolean
): Record<string, unknown> {
  // 尝试解析组件（如果未提供或者是字符串）
  let resolvedComponent = component
  if (!resolvedComponent || typeof resolvedComponent === 'string') {
    try {
      const resolved = resolveComponent(componentType)
      if (resolved && typeof resolved !== 'string') {
        resolvedComponent = resolved
      }
    } catch {
      // 解析失败，使用默认配置
    }
  }
  
  // 获取配置（支持具名 model）
  const config = modelName 
    ? getNamedModelConfig(componentType, resolvedComponent, modelName)
    : getModelConfig(componentType, resolvedComponent)
  
  // 获取当前值
  let value = getState
    ? getPathValue(getState(), modelPath)
    : ctx._get(modelPath)
  
  // 如果值是 undefined，使用 schema 默认值或按 prop 推断的默认值；lazy 时不写回 state
  if (value === undefined) {
    const defaultValue =
      schemaDefault !== undefined ? schemaDefault : getDefaultValue(config.prop)
    if (defaultValue !== undefined) {
      value = defaultValue
      if (!schemaLazy) {
        ctx._set(modelPath as any, defaultValue as any)
      }
    }
  }
  
  return {
    [config.prop]: value,
    [toEventHandlerName(config.event)]: (newValue: unknown) => {
      // 直接设置到运行时上下文，会触发 onStateChange 同步到 Vue 状态
      ctx._set(modelPath, newValue)
    }
  }
}

/**
 * 获取具名 model 配置（支持多 model）
 */
function getNamedModelConfig(
  componentType: string, 
  component: unknown, 
  modelName: string
): ModelConfig {
  // 1. 检查自定义配置
  const customKey = `${componentType}:${modelName}`
  const custom = customConfigs.get(customKey)
  if (custom) return custom
  
  // 2. 尝试从组件定义检测
  if (component && typeof component === 'object') {
    const comp = component as Record<string, unknown>
    const props = (comp.props || {}) as Record<string, unknown>
    const emits = (comp.emits || []) as string[]
    
    // Vue 3.4+ 多 model 支持
    if (modelName in props) {
      return {
        prop: modelName,
        event: emits.includes(`update:${modelName}`) 
          ? `update:${modelName}` 
          : `update:${modelName}`
      }
    }
  }
  
  // 3. 默认规则：prop 为 modelName，event 为 update:modelName
  return {
    prop: modelName,
    event: `update:${modelName}`
  }
}

/**
 * 注册自定义组件的 model 配置
 * @param componentType 组件类型名
 * @param config model 配置
 * @param modelName 具名 model（可选）
 */
export function registerModelConfig(
  componentType: string, 
  config: ModelConfig,
  modelName?: string
): void {
  const key = modelName ? `${componentType}:${modelName}` : componentType
  customConfigs.set(key, config)
}

/**
 * 清除自定义配置
 */
export function clearModelConfigs(): void {
  customConfigs.clear()
}
