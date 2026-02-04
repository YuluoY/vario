/**
 * Schema 相关类型定义
 */

import type { Action } from './action.js'

/**
 * Model 修饰符类型
 * 
 * Vue 3 标准 v-model 修饰符：
 * - trim: 去除输入值的首尾空格
 * - number: 自动将输入值转换为数字
 * - lazy: 使用 change 事件而不是 input 事件更新
 * 
 * 也支持自定义修饰符
 */
export type ModelModifiers = 
  | ReadonlyArray<'trim' | 'number' | 'lazy' | string>
  | Readonly<Record<'trim' | 'number' | 'lazy' | string, boolean>>

/**
 * 事件修饰符类型
 * 
 * DOM 事件修饰符：
 * - stop: 阻止事件冒泡（event.stopPropagation()）
 * - prevent: 阻止默认行为（event.preventDefault()）
 * - capture: 使用捕获模式
 * - self: 只当事件在该元素本身触发时才执行
 * - once: 事件只触发一次
 * - passive: 提升移动端性能（不调用 preventDefault）
 * 
 * 键盘修饰符：
 * - enter, tab, delete, esc, space, up, down, left, right
 * 
 * 系统修饰符：
 * - ctrl, alt, shift, meta
 * 
 * 鼠标修饰符：
 * - left, right, middle
 */
export type EventModifier = 
  // DOM 事件修饰符
  | 'stop' | 'prevent' | 'capture' | 'self' | 'once' | 'passive'
  // 键盘修饰符
  | 'enter' | 'tab' | 'delete' | 'esc' | 'space' | 'up' | 'down' | 'left' | 'right'
  // 系统修饰符
  | 'ctrl' | 'alt' | 'shift' | 'meta'
  // 鼠标修饰符
  | 'left' | 'right' | 'middle'
  // 自定义修饰符
  | string

export type EventModifiers = 
  | ReadonlyArray<EventModifier>
  | Readonly<Record<EventModifier, boolean>>

/**
 * 常见的 DOM/Vue 事件名称
 */
export type CommonEventName = 
  // 鼠标事件
  | 'click' | 'dblclick' | 'mousedown' | 'mouseup' | 'mousemove' | 'mouseenter' | 'mouseleave' | 'mouseover' | 'mouseout'
  // 键盘事件
  | 'keydown' | 'keyup' | 'keypress'
  // 表单事件
  | 'input' | 'change' | 'submit' | 'focus' | 'blur' | 'reset'
  // 拖拽事件
  | 'drag' | 'dragstart' | 'dragend' | 'dragover' | 'dragenter' | 'dragleave' | 'drop'
  // 滚动和缩放
  | 'scroll' | 'resize' | 'wheel'
  // 剪贴板事件
  | 'copy' | 'cut' | 'paste'
  // 触摸事件
  | 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel'
  // Vue 组件事件 (update:xxx)
  | `update:${string}`
  // Element Plus 常见事件
  | 'selection-change' | 'current-change' | 'row-click' | 'cell-click'
  | 'sort-change' | 'filter-change' | 'expand-change'
  | 'opened' | 'closed' | 'open' | 'close'
  // 自定义事件
  | string

/**
 * 事件名称类型（支持修饰符点语法）
 * 
 * @example
 * type T1 = EventName  // 'click' | 'input' | 'submit' | ...
 * type T2 = EventName  // 'click.stop' | 'click.prevent' | ...
 * type T3 = EventName  // 'keydown.enter' | 'keydown.ctrl.enter' | ...
 */
export type EventName = 
  | CommonEventName
  | `${CommonEventName}.${EventModifier}`
  | `${CommonEventName}.${EventModifier}.${EventModifier}`
  | `${CommonEventName}.${EventModifier}.${EventModifier}.${EventModifier}`
  | `${string}.${EventModifier}`
  | string

/**
 * model 作用域/绑定配置
 * - path: 绑定路径
 * - scope: true 时仅作子节点路径作用域，不在本节点绑定
 * - default: 当状态中该路径值为 undefined 时使用的默认值（仅在本节点绑定时生效）
 * - lazy: true 时不预写 state，仅在该 model 值变化后才写入 state
 * - modifiers: v-model 修饰符（trim, number, lazy 等）
 */
export interface ModelScopeConfig {
  readonly path: string
  readonly scope?: boolean
  /** 状态未初始化时使用的默认值 */
  readonly default?: unknown
  /** true 时不预写 state，仅当用户修改该绑定值后才写入 state */
  readonly lazy?: boolean
  /** v-model 修饰符 */
  readonly modifiers?: ModelModifiers
}

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
   * 事件处理器（支持多种格式）
   * 
   * 键为事件名，支持修饰符语法（Vue 风格）：
   * - "click" - 普通事件
   * - "click.stop" - 带单个修饰符
   * - "click.stop.prevent" - 带多个修饰符
   * 
   * 值支持多种格式：
   * 1. Action 对象
   * 2. Action 对象数组
   * 3. 字符串（method 名简写）
   * 4. 字符串数组（多个 method 名）
   * 5. 数组简写 [type, method, args?, modifiers?]（四个固定位置，类似指令格式）
   * 
   * @example
   * // 单个 action 对象
   * { "click.stop": { type: "call", method: "handleClick" } }
   * 
   * // Action 数组
   * { click: [{ type: "call", method: "validate" }, { type: "emit", event: "submit" }] }
   * 
   * // 字符串简写（自动转为 call action）
   * { "click.prevent": "handleSubmit" }
   * 
   * // 字符串数组
   * { submit: ["validate", "submit"] }
   * 
   * // 数组简写格式（四个固定位置）
   * { click: ["call", "handleClick", ["{{name}}"], ["stop"]] }
   * { click: ["call", "handleClick", ["{{name}}"], { stop: true, prevent: true }] }
   */
  readonly events?: Readonly<Record<EventName, EventHandler>>

  /**
   * 自定义指令配置（类似 Vue 的 v-directive）
   * 
   * 支持多种格式：
   * 1. 完整对象：{ name: 'focus', value: true, arg: 'param', modifiers: { lazy: true } }
   * 2. 数组简写（类似 Vue withDirectives）：['focus', true, 'param', { lazy: true }]
   * 3. 对象映射：{ focus: true } 或 { focus: 'value' }
   * 
   * @example
   * // 完整对象
   * directives: [{
   *   name: 'focus',
   *   value: '{{ shouldFocus }}',
   *   arg: 'param',
   *   modifiers: { lazy: true }
   * }]
   * 
   * // 数组简写（参考 Vue withDirectives）
   * directives: [
   *   ['focus', true],
   *   ['custom', '{{ value }}', 'arg', { mod1: true }]
   * ]
   * 
   * // 对象映射简写
   * directives: {
   *   focus: true,
   *   custom: '{{ value }}'
   * }
   */
  readonly directives?: DirectiveConfig

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
   * 双向绑定路径或作用域配置（单 model）
   * 
   * - 字符串：绑定路径，在 autoResolve 时会参与路径栈并创建绑定
   * - 对象：path 必填；scope: true 时仅作子节点路径作用域不绑定；default 为状态未初始化时的默认值
   * 
   * @example "user.name"
   * @example { path: "form", scope: true }
   * @example { path: "name", default: "张三" }
   * @example { path: "optional", lazy: true }
   */
  readonly model?: string | ModelScopeConfig

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

  /**
   * 自定义扩展属性
   * 
   * 允许挂载任意自定义属性，用于元数据、调试信息、扩展功能或特定业务需求。
   * 这些属性会被核心渲染器忽略，不会参与渲染，但可以在自定义处理器中使用。
   * 
   * 注意：属性名应避免与标准属性冲突（如 type、props、model 等）。
   * 建议使用命名空间前缀（如 myLib_xxx）来避免冲突。
   * 
   * @example
   * { 
   *   type: 'div', 
   *   raw: { source: 'api', id: 123 },
   *   debug: true,
   *   meta: { author: 'team-a' },
   *   myPlugin_config: { animate: true }
   * }
   */
  readonly [key: string]: unknown
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
 * 事件处理器数组简写格式（四个固定位置，类似指令格式）
 * [type, method, args?, modifiers?]
 * 
 * @example ['call', 'submit']
 * @example ['call', 'submit', ['{{name}}', '{{age}}']]
 * @example ['call', 'submit', [], ['stop', 'prevent']]
 * @example ['call', 'submit', ['{{id}}'], { stop: true }]
 */
export type EventHandlerArray = readonly [
  string,                                         // type: action 类型
  string,                                         // method: 方法名
  (ReadonlyArray<unknown> | undefined)?,          // args: 参数数组
  (EventModifiers | undefined)?                   // modifiers: 事件修饰符
]

/**
 * 事件处理器类型（支持多种格式）
 */
export type EventHandler = 
  | Action                                    // 单个 action 对象
  | ReadonlyArray<Action>                     // action 对象数组
  | string                                    // method 名简写（自动转为 call action）
  | ReadonlyArray<string>                     // method 名数组
  | EventHandlerArray                         // 数组简写 [type, method, args?, modifiers?]

/**
 * 单个指令配置对象
 */
export interface DirectiveObject {
  /**
   * 指令名称（不含 v- 前缀）
   * 
   * @example 'focus'
   * @example 'custom-directive'
   */
  readonly name: string
  
  /**
   * 指令的值（支持表达式）
   * 
   * @example true
   * @example '{{ isVisible }}'
   * @example { key: 'value' }
   */
  readonly value?: unknown
  
  /**
   * 指令参数
   * 
   * @example 'param' // v-bind:param
   */
  readonly arg?: string
  
  /**
   * 指令修饰符
   * 
   * @example { lazy: true, trim: true }
   */
  readonly modifiers?: Record<string, boolean>
}

/**
 * 指令数组简写格式（参考 Vue withDirectives）
 * [name, value?, arg?, modifiers?]
 */
export type DirectiveArray = readonly [
  string,                           // name
  (unknown | undefined)?,           // value
  (string | undefined)?,            // arg
  (Record<string, boolean> | undefined)?  // modifiers
]

/**
 * 指令配置类型（支持多种格式）
 */
export type DirectiveConfig =
  | DirectiveObject                              // 单个完整对象
  | DirectiveArray                               // 数组简写
  | ReadonlyArray<DirectiveObject | DirectiveArray> // 多个指令（对象或数组）
  | Readonly<Record<string, unknown>>            // 对象映射 { focus: true }

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
    ctx: any  // 避免循环依赖
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
