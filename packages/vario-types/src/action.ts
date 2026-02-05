/**
 * Action 相关类型定义
 */

/**
 * 动作类型映射
 * 根据 type 值推导对应的动作参数类型
 */
export type ActionMap = {
  set: { path: string; value: string | unknown }
  emit: { event: string; data?: string | unknown }
  navigate: { to: string }
  log: { level?: 'info' | 'warn' | 'error'; message: string }
  if: { cond: string; then?: Action[]; else?: Action[] }
  loop: { var: string; in: string; body: Action[] }
  call: { 
    method: string; 
    params?: string | Record<string, unknown> | unknown[];  // 支持表达式字符串、对象（命名参数）或数组（位置参数）
    resultTo?: string;
    modifiers?: import('./schema.js').EventModifiers  // 事件修饰符
  }
  batch: { actions: Action[] }
  push: { path: string; value: string | unknown }
  pop: { path: string }
  shift: { path: string }
  unshift: { path: string; value: string | unknown }
  splice: { path: string; start: number | string; deleteCount?: number | string; items?: string | unknown[] }
}

/**
 * 动作类型（所有支持的 action type）
 */
export type ActionType = keyof ActionMap

/**
 * 动作接口
 * 支持类型推导：根据 type 推导对应的参数结构
 * 
 * @example
 * // type 字段会有智能提示：'call' | 'set' | 'emit' | ...
 * const action: Action = { type: 'call', method: 'handleClick' }
 */
export type Action = 
  | {
      [K in keyof ActionMap]: {
        readonly type: K
      } & Readonly<ActionMap[K]>
    }[keyof ActionMap]
  | {
      readonly type: string
    }

/**
 * 类型守卫：检查动作是否符合特定类型
 */
export function isActionOfType<T extends keyof ActionMap>(
  action: Action,
  actionType: T
): action is Action & ActionMap[T] {
  return action.type === actionType
}

/**
 * 可写的 Action 类型（用于构建 Action 对象）
 * 移除了 readonly 修饰符，允许动态赋值
 */
export type WritableAction<T extends keyof ActionMap = keyof ActionMap> = {
  type: T
} & ActionMap[T]

/**
 * 创建特定类型的 Action（类型安全的构建器）
 * @example
 * const action = createAction('call', { method: 'handleClick' })
 * action.params = ['arg1', 'arg2'] // 类型安全
 */
export function createAction<T extends keyof ActionMap>(
  type: T,
  props: ActionMap[T]
): WritableAction<T> {
  return { type, ...props } as WritableAction<T>
}
