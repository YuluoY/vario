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
import type { RuntimeContext } from '@variojs/types'
import type { SchemaNode } from '@variojs/schema'
import { getPathValue } from '@variojs/core'

/** VUE-8：每个 ctx+path 只激活一次，不为每轮 render 创建 timer */
const lazyActivated = new WeakMap<object, Map<string, boolean>>()

function isLazyModelActive(ctx: object, path: string): boolean {
  return lazyActivated.get(ctx)?.get(path) === true
}

function scheduleLazyModelActivation(ctx: object, path: string): void {
  let paths = lazyActivated.get(ctx)
  if (!paths) {
    paths = new Map()
    lazyActivated.set(ctx, paths)
  }
  if (paths.has(path)) return
  paths.set(path, false)
  queueMicrotask(() => {
    lazyActivated.get(ctx)?.set(path, true)
  })
}

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
function getModelConfig(
  componentType: string,
  component?: unknown,
  pageConfigs?: Map<string, ModelConfig>
): ModelConfig {
  // 1. 页面级配置优先，再查全局自定义配置
  const custom = pageConfigs?.get(componentType) ?? customConfigs.get(componentType)
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
 * @param modifiers v-model 修饰符（可选，如 { trim: true, lazy: true, number: true }）
 * @param pageConfigs 页面级 model 配置，优先于全局 registerModelConfig
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
  schemaLazy?: boolean,
  modifiers: Record<string, boolean> = {},
  pageConfigs?: Map<string, ModelConfig>
): Record<string, unknown> {
  // 尝试解析组件（如果未提供或者是字符串）
  let resolvedComponent = component
  if (!resolvedComponent || typeof resolvedComponent === 'string') {
    const looksCustom = /[A-Z-]/.test(componentType)
    if (looksCustom) {
      try {
        const resolved = resolveComponent(componentType)
        if (resolved && typeof resolved !== 'string') {
          resolvedComponent = resolved
        }
      } catch {
        // 解析失败，使用默认配置
      }
    }
  }
  
  // 获取配置（支持具名 model）
  const config = modelName 
    ? getNamedModelConfig(componentType, resolvedComponent, modelName, pageConfigs)
    : getModelConfig(componentType, resolvedComponent, pageConfigs)
  
  // 获取当前值（从用户传入的 state 或 context 中）
  let value = getState
    ? getPathValue(getState(), modelPath)
    : ctx._get(modelPath)
  
  // 检查用户传入的 state 中是否已存在该值
  const stateExists = value !== undefined
  
  // 如果 state 中不存在该值，使用 schema 默认值或按 prop 推断的默认值
  if (!stateExists) {
    const defaultValue =
      schemaDefault !== undefined ? schemaDefault : getDefaultValue(config.prop)
    if (defaultValue !== undefined) {
      value = defaultValue
      // 非 lazy 模式时，预写默认值到 state（触发 onStateChange 以同步到 Vue reactiveState）
      // lazy 模式时，仅使用默认值作为本地值，不写入 state
      if (!schemaLazy) {
        ctx._set(modelPath as any, defaultValue as any)
      }
    }
  }
  
  if (schemaLazy) {
    scheduleLazyModelActivation(ctx, modelPath)
  }

  /**
   * 应用修饰符转换
   */
  const applyModifiers = (value: unknown): unknown => {
    let result = value
    
    // .trim - 去除首尾空格
    if (modifiers.trim && typeof result === 'string') {
      result = result.trim()
    }
    
    // .number - 转换为数字
    if (modifiers.number) {
      if (typeof result === 'string') {
        const parsed = parseFloat(result)
        result = isNaN(parsed) ? result : parsed
      }
    }
    
    return result
  }

  const updateHandler = (newValue: unknown) => {
    // 应用修饰符
    const transformed = applyModifiers(newValue)
    
    // 如果 state 中已存在值（用户传入），直接更新
    if (stateExists) {
      ctx._set(modelPath, transformed)
      return
    }

    // lazy 模式：未激活前（挂载阶段）的更新不写入 state
    if (schemaLazy && !isLazyModelActive(ctx, modelPath)) {
      return
    }

    // 用户交互，写入 state
    ctx._set(modelPath, transformed)
  }

  // .lazy 修饰符 - 改用 change/blur 事件而不是 input/update 事件
  const eventName = modifiers.lazy && config.event.includes('input')
    ? config.event.replace('input', 'change')
    : modifiers.lazy && config.event.includes('update')
      ? config.event.replace('update', 'change')
      : config.event

  return {
    [config.prop]: value,
    [toEventHandlerName(eventName)]: updateHandler
  }
}

/**
 * 获取具名 model 配置（支持多 model）
 */
function getNamedModelConfig(
  componentType: string, 
  component: unknown, 
  modelName: string,
  pageConfigs?: Map<string, ModelConfig>
): ModelConfig {
  // 1. 页面级配置优先，再查全局自定义配置
  const customKey = `${componentType}:${modelName}`
  const custom = pageConfigs?.get(customKey) ?? customConfigs.get(customKey)
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

/**
 * LIFE-4：把 useVario modelBindings 编成页面级表，不写入全局 customConfigs。
 */
export function createBindingConfigTable(bindings?: Record<string, ModelConfig>): Map<string, ModelConfig> {
  const table = new Map<string, ModelConfig>()
  if (!bindings) return table
  for (const [key, config] of Object.entries(bindings)) {
    if (!config) continue
    if (key.includes(':')) {
      const [component, modelName] = key.split(':')
      table.set(`${component}:${modelName}`, config)
    } else {
      table.set(key, config)
    }
  }
  return table
}

function joinModelPath(prefix: string, path: string): string {
  if (!prefix) return path
  if (!path) return prefix
  return `${prefix}.${path}`
}

function readModelField(model: unknown): { path?: string; scope: boolean; lazy: boolean; defaultValue: unknown } {
  if (typeof model === 'string') {
    return { path: model, scope: false, lazy: false, defaultValue: undefined }
  }
  if (model && typeof model === 'object') {
    const rec = model as { path?: string; scope?: boolean; lazy?: boolean; default?: unknown }
    return {
      path: typeof rec.path === 'string' ? rec.path : undefined,
      scope: rec.scope === true,
      lazy: rec.lazy === true,
      defaultValue: rec.default
    }
  }
  return { scope: false, lazy: false, defaultValue: undefined }
}

/**
 * SSR-3 / VUE-8：在首帧 render 前把 model.default 写入 state，避免 render 中写持久 store。
 */
export function applySchemaModelDefaults(
  schema: SchemaNode,
  ctx: RuntimeContext,
  options: { lazy?: boolean } = {}
): void {
  const globalLazy = options.lazy === true
  const walk = (node: unknown, prefix: string, inLoop: boolean): void => {
    if (!node || typeof node !== 'object') return
    const rec = node as SchemaNode & Record<string, unknown>
    let nextPrefix = prefix
    const applyField = (model: unknown, allowScope: boolean): void => {
      const field = readModelField(model)
      if (!field.path) return
      const full = joinModelPath(prefix, field.path)
      if (!inLoop && !globalLazy && !field.lazy && field.defaultValue !== undefined && ctx._get(full) === undefined) {
        ctx._set(full as never, field.defaultValue as never)
      }
      if (allowScope && field.scope) nextPrefix = full
    }
    applyField(rec.model, true)
    for (const [key, value] of Object.entries(rec)) {
      if (key.startsWith('model:') && key !== 'model') applyField(value, false)
    }
    const nestedLoop = inLoop || rec.loop != null
    const children = rec.children
    if (Array.isArray(children)) {
      for (const child of children) walk(child, nextPrefix, nestedLoop)
    } else if (children && typeof children === 'object') {
      walk(children, nextPrefix, nestedLoop)
    }
    const slots = rec.slots
    if (slots && typeof slots === 'object') {
      for (const slot of Object.values(slots as Record<string, unknown>)) {
        if (Array.isArray(slot)) {
          for (const child of slot) walk(child, nextPrefix, nestedLoop)
        } else {
          walk(slot, nextPrefix, nestedLoop)
        }
      }
    }
  }
  walk(schema, '', false)
}
