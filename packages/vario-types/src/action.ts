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
    params?: string | Record<string, unknown>;  // 支持表达式字符串或对象
    args?: unknown[];  // 位置参数（事件数组简写格式）
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
