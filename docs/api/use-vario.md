# useVario

```typescript
function useVario<TState extends Record<string, unknown>>(
  schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>,
  options?: UseVarioOptions<TState>
): UseVarioResult<TState>
```

## Options

```typescript
interface UseVarioOptions<TState> {
  /** 初始状态（会自动包裹为响应式对象） */
  state?: TState
  
  /** 计算属性（传入 Vue ComputedRef） */
  computed?: Record<string, ((state: TState) => any) | ComputedRef<any>>
  
  /** 方法定义 */
  methods?: Record<string, (context: MethodContext<TState>) => any>
  
  /** 表达式选项 */
  exprOptions?: ExpressionOptions
  
  /** 自定义 model 绑定配置 */
  modelBindings?: Record<string, ModelConfig>
  
  /** Model 路径解析配置（可选，仅与格式相关如 separator） */
  modelPath?: {
    separator?: string  // 默认 '.'
  }
  
  /** 渲染器选项 */
  rendererOptions?: VueRendererOptions
  
  /** 错误边界配置 */
  errorBoundary?: {
    enabled?: boolean
    fallback?: (error: Error) => VNode
  }
  
  /** 事件发射器 */
  onEmit?: (event: string, data?: unknown) => void
}
```

## 返回值

```typescript
interface UseVarioResult<TState> {
  /** 渲染的 VNode */
  vnode: Ref<VNode | null>
  
  /** 响应式状态（自动包裹） */
  state: TState
  
  /** 运行时上下文 */
  ctx: Ref<RuntimeContext<TState>>
  
  /** 模板引用集合 */
  refs: Record<string, Ref<any>>
  
  /** 当前错误（如果有） */
  error: Ref<Error | null>
  
  /** 手动触发重新渲染 */
  retry: () => void
}
```
