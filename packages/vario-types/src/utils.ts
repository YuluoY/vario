/**
 * Utils 类型定义
 */

/**
 * 路径段类型
 */
export type PathSegment = string | number

/**
 * 路径值类型推导工具
 * 根据路径字符串推导对应的值类型，支持对象嵌套与数组索引
 *
 * @example
 * GetPathValue<{ user: { name: string } }, 'user.name'> // string
 * GetPathValue<{ items: number[] }, 'items.0'> // number
 * GetPathValue<{ list: { id: number }[] }, 'list.0.id'> // number
 */
export type GetPathValue<T, TPath extends string> =
  TPath extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? T[Key] extends Record<string, unknown>
        ? GetPathValue<T[Key], Rest>
        : T[Key] extends readonly (infer E)[]
          ? Rest extends `${number}`
            ? E
            : Rest extends `${number}.${infer R}`
              ? GetPathValue<E, R>
              : unknown
          : unknown
      : unknown
    : TPath extends keyof T
      ? T[TPath]
      : unknown

/**
 * 路径设置值类型推导工具
 * 根据路径字符串推导可以设置的值类型
 */
export type SetPathValue<T, TPath extends string> = GetPathValue<T, TPath>

/**
 * 状态变更回调：path 与 value 类型联动，TPath 由 path 推导，value 为 GetPathValue<TState, TPath>
 */
export type OnStateChangeCallback<TState extends Record<string, unknown>> = <TPath extends string>(
  path: TPath,
  value: GetPathValue<TState, TPath>,
  ctx: any  // 避免循环引用，使用 any
) => void

/**
 * 从 Schema 推导状态类型
 * 
 * @example
 * type MyState = InferStateType<typeof mySchema>
 */
export type InferStateType<TSchema> = 
  TSchema extends { stateType: infer TState }
    ? TState
    : never

/**
 * 类型工具：从 DefineSchemaConfig 推导状态类型
 */
export type InferStateFromConfig<TConfig> = 
  TConfig extends { state: infer TState }
    ? TState
    : never

/**
 * 类型工具：从 DefineSchemaConfig 推导服务类型
 */
export type InferServicesFromConfig<TConfig> = 
  TConfig extends { services: infer TServices }
    ? TServices
    : never
