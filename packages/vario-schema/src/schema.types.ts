/**
 * Vario Schema DSL 类型定义
 * 
 * 遵循 TypeScript 最佳实践：
 * - 使用严格的类型定义，避免 any
 * - 使用 readonly 确保不可变性
 * - 使用联合类型和字面量类型
 * - 使用接口支持扩展
 */

import type { Action, RuntimeContext } from '@variojs/core'

/**
 * Schema 节点接口
 * 
 * 表示 Vario Schema 中的一个节点，可以是组件、元素或文本
 * 
 * @template TState 状态类型，用于类型推导
 */
export interface SchemaNode<TState extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * 组件类型或 HTML 标签名
   * 
   * @example "Button", "Input", "div"
   */
  readonly type: string

  /**
   * 组件属性
   * 
   * 支持表达式插值（字符串形式的表达式会被求值）
   * 
   * @example { label: "提交", disabled: "{{ !user.name }}" }
   */
  readonly props?: Readonly<Record<string, unknown>>

  /**
   * 子节点
   * 
   * 可以是：
   * - SchemaNode 数组（多个子节点）
   * - 字符串（文本节点，支持表达式插值）
   * 
   * @example ["文本内容", { type: "Button", ... }]
   * @example "{{ user.name }}"
   */
  readonly children?: ReadonlyArray<SchemaNode<TState>> | string

  /**
   * 事件处理器
   * 
   * 键为事件名（如 "click", "change"），值为动作序列
   * 
   * @example { click: [{ type: "emit", event: "submit" }] }
   */
  readonly events?: Readonly<Record<string, ReadonlyArray<Action>>>

  /**
   * 条件渲染表达式
   * 
   * 当表达式为真时渲染该节点
   * 
   * @example "user.age >= 18"
   */
  readonly cond?: string

  /**
   * 可见性控制表达式
   * 
   * 当表达式为真时显示该节点（使用 CSS display 控制）
   * 
   * @example "isVisible"
   */
  readonly show?: string

  /**
   * 列表渲染配置
   * 
   * 用于循环渲染列表项
   */
  readonly loop?: Readonly<LoopConfig>

  /**
   * 双向绑定路径（单 model）
   * 
   * 用于表单元素的双向数据绑定
   * 
   * @example "user.name"
   */
  readonly model?: string

  /**
   * 具名双向绑定（多 model，Vue 3.4+）
   * 
   * 支持多个 model 绑定，键为 model 名称，值为路径
   * 
   * @example { checked: "user.agreed", value: "user.email" }
   */
  readonly [key: `model:${string}`]: string

  /**
   * 插槽名称（用于 template 节点）
   * 
   * 当 type 为 'template' 时，指定插槽名称
   * 
   * @example { type: 'template', slot: 'default', props: { scope: 'scope' }, children: '...' }
   */
  readonly slot?: string
}

/**
 * 列表渲染配置
 */
export interface LoopConfig {
  /**
   * 数据源路径（表达式）
   * 
   * 指向状态中的数组或对象
   * 
   * @example "items"
   * @example "user.roles"
   */
  readonly items: string

  /**
   * 循环变量名
   * 
   * 在循环体内可通过此变量访问当前项
   * 
   * @example "item"
   * @example "role"
   */
  readonly itemKey: string

  /**
   * 索引变量名（可选）
   * 
   * 在循环体内可通过此变量访问当前索引
   * 
   * @example "index"
   */
  readonly indexKey?: string
}

/**
 * Schema 根节点类型
 * 
 * Schema 本身就是一个 SchemaNode
 */
export type Schema<TState extends Record<string, unknown> = Record<string, unknown>> = 
  SchemaNode<TState>

/**
 * 类型工具：从 Schema 推导状态类型
 * 
 * @example
 * type MyState = InferStateType<typeof mySchema>
 */
export type InferStateType<TSchema> = 
  TSchema extends SchemaNode<infer TState> 
    ? TState 
    : TSchema extends Schema<infer TState>
      ? TState
      : never

/**
 * 类型工具：从 DefineSchemaConfig 推导状态类型
 */
export type InferStateFromConfig<TConfig> = 
  TConfig extends DefineSchemaConfig<infer TState, any>
    ? TState
    : never

/**
 * 类型工具：从 DefineSchemaConfig 推导服务类型
 */
export type InferServicesFromConfig<TConfig> = 
  TConfig extends DefineSchemaConfig<any, infer TServices>
    ? TServices
    : never

/**
 * defineSchema 配置接口
 * 
 * @template TState 状态类型
 * @template TServices 服务类型
 */
export interface DefineSchemaConfig<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TServices extends Record<string, (...args: unknown[]) => unknown> = Record<string, (...args: unknown[]) => unknown>
> {
  /**
   * 初始状态定义
   * 
   * 用于类型推导和运行时初始化
   */
  readonly state: TState

  /**
   * 业务逻辑服务（可选）
   * 
   * 服务函数可以访问全局对象（如 fetch, localStorage）
   * 会自动注册到 ctx.$methods['services.*']
   */
  readonly services?: Readonly<TServices>

  /**
   * Schema 函数
   * 
   * 接收运行时上下文，返回 Schema
   * 
   * @param ctx 运行时上下文（包含 state, services, $emit 等）
   * @returns Schema 节点
   */
  readonly schema: (
    ctx: RuntimeContext<TState>
  ) => Schema<TState>
}

/**
 * VarioView 类型
 * 
 * defineSchema 的返回值类型
 * 包含编译后的 Schema 和元数据
 */
export interface VarioView<TState extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * 编译后的纯 Schema（JSON 格式）
   */
  readonly schema: Schema<TState>

  /**
   * 状态类型（用于类型推导）
   */
  readonly stateType: TState

  /**
   * 服务类型（用于类型推导）
   */
  readonly servicesType?: Record<string, (...args: unknown[]) => unknown>
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

/**
 * Schema 验证错误
 */
export class SchemaValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
    public readonly code?: string,
    public readonly context?: SchemaValidationErrorContext
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
