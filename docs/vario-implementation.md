# Vario 技术实现指南

> **面向核心开发者与架构师的完整技术设计文档**  
> 描述如何从零构建 Vario：UI 行为虚拟机的完整技术方案

---

## 0. 技术定位

### 核心概念

**Vario = UI 行为中间表示（IR）+ 运行时虚拟机（VM）+ 渐进式跨框架抽象层**

- Schema-first 的可执行 UI 行为 DSL
- 框架无关的核心运行时
- 清晰的安全边界与性能优化

### 设计原则

1. **Schema 是唯一真相来源**：JSON Schema DSL 是核心，defineSchema 是编译期增强
2. **扁平化状态设计**：状态直接挂载到上下文顶层，路径访问简洁自然
3. **系统 API 清晰标识**：`$` 前缀区分系统功能与用户状态
4. **安全模型分层**：表达式层严格沙箱，方法层可控访问
5. **渐进式跨框架**：核心运行时框架无关，渲染层可适配不同框架

---

## 1. 架构设计

### 1.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Tooling & Agent                                    │
│ ├─ Agent Skill (AI 技能定义与防护)                          │
│ └─ Dev Tools (构建工具与调试器)                              │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Rendering Backends                                 │
│ ├─ Vue Renderer (Schema → VNode)                           │
│ ├─ React Renderer (Schema → ReactElement)                  │
│ └─ Framework Adapters (框架适配层)                          │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Schema Layer                                       │
│ ├─ Schema Types (Schema 类型定义)                           │
│ ├─ Validator (Schema 结构校验)                              │
│ └─ Transform (编译期转换与优化)                             │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Core Runtime (框架无关)                            │
│ ├─ Action VM (动作虚拟机)                                   │
│ ├─ Expression System (表达式引擎)                           │
│ ├─ Runtime Context (运行时上下文)                           │
│ ├─ Method Registry (方法注册与权限管理)                     │
│ └─ Security Sandbox (安全沙箱)                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 数据流

```
Schema JSON
    ↓
[Validator] 结构校验 + 表达式校验
    ↓
[Runtime Context] 创建运行时上下文
    ↓
[Expression Engine] 求值表达式
    ↓
[Action VM] 执行指令
    ↓
[Renderer] 渲染到具体框架
    ↓
UI Components
```

---

## 2. Core Runtime 设计

### 2.1 Runtime Context

运行时上下文是 Vario 的核心数据结构，承载状态、方法与系统 API。

#### 接口设计

```typescript
// 状态类型约束：禁止使用 $ 和 _ 前缀的键，避免与系统 API 冲突
type ValidStateKey<T> = T extends `$${string}` | `_${string}` ? never : T
type SafeState<T> = {
  [K in keyof T as ValidStateKey<K & string>]: T[K]
}

interface RuntimeContext<TState extends Record<string, any> = Record<string, any>> {
  // 系统 API（$ 前缀保护）
  $emit: (event: string, data?: any) => void
  $methods: Record<string, Function>
  $event?: any        // 当前事件对象
  $item?: any         // 循环当前项
  $index?: number     // 循环索引
  
  // 内部路径操作（下划线前缀，不对外）
  _get: (path: string) => any
  _set: (path: string, value: any, options?: { skipCallback?: boolean }) => void
  
  // 用户状态（扁平化挂载，类型约束确保安全）
  [K: string]: any
}
```

#### 实现要点

**1. 扁平化状态存储**

```typescript
// 用户状态直接挂载到上下文顶层
ctx.user.name = '张三'
ctx.todos = [{ id: 1, text: 'Task 1' }]
```

**2. 路径解析与缓存**

```typescript
// 路径格式：点分隔，支持数组索引
_get('user.profile.avatar')     // 嵌套对象
_get('todos.0.completed')       // 数组元素属性
_get('items.length')            // 数组属性

// 路径解析缓存
const pathCache = new Map<string, PathSegment[]>()
function parsePathCached(path: string): PathSegment[] {
  if (pathCache.has(path)) return pathCache.get(path)!
  const segments = parsePath(path)
  pathCache.set(path, segments)
  return segments
}
```

**3. 状态变更钩子**

```typescript
interface RuntimeContextOptions {
  onStateChange?: (path: string, value: any, ctx: RuntimeContext) => void
}

// 状态变更时触发(支持跳过回调以防止循环)
ctx._set('user.name', '李四')
// → onStateChange('user.name', '李四', ctx)
// → 失效相关表达式缓存
// → 触发视图更新

// 跳过回调(用于状态同步场景)
ctx._set('user.name', '李四', { skipCallback: true })
```

**4. 代理保护**

```typescript
function createProxy<T extends Record<string, any>>(ctx: RuntimeContext<T>): RuntimeContext<T> {
  return new Proxy(ctx, {
    set(target, key, value) {
      const keyStr = key.toString()
      
      // 禁止覆盖系统 API
      if (keyStr.startsWith('$') || keyStr.startsWith('_')) {
        throw new RuntimeError(
          `Cannot override system API: ${keyStr}`,
          'PROTECTED_KEY'
        )
      }
      
      // 禁止设置危险属性
      if (['__proto__', 'constructor', 'prototype'].includes(keyStr)) {
        throw new RuntimeError(
          `Cannot set unsafe property: ${keyStr}`,
          'UNSAFE_KEY'
        )
      }
      
      target[key] = value
      return true
    }
  })
}
```

### 2.2 Expression System

表达式系统负责安全地求值 Schema 中的动态表达式。

#### 核心约束

- **只读**：表达式不能修改状态
- **无副作用**：不能调用有副作用的函数
- **沙箱隔离**：默认无法访问全局对象
- **白名单机制**：仅允许安全的 AST 节点和函数

#### 执行流程

```typescript
// 1. 解析表达式为 AST
const ast = parse(expression)

// 2. AST 白名单校验
validateAST(ast, {
  allowedNodeTypes: ['Literal', 'Identifier', 'MemberExpression', 'BinaryExpression', ...],
  allowedFunctions: ['Math.floor', 'Math.ceil', 'Array.map', 'Array.filter', ...]
})

// 3. 可选编译优化（静态路径 → 直接访问）
const compiled = compile(ast)  // 仅针对简单表达式

// 4. 沙箱求值
const result = evaluateExpression(ast, ctx, {
  allowGlobals: false,  // 默认拒绝全局对象
  maxSteps: 1000,       // 最大执行步数
  timeout: 100          // 超时限制（ms）
})
```

#### 两级缓存策略（推荐）

> **说明**：初期实现推荐使用两级缓存（AST + 结果），编译缓存可作为后期性能优化项

**1. AST 缓存**

```typescript
const astCache = new Map<string, ESTree.Node>()

function parseWithCache(expr: string): ESTree.Node {
  if (astCache.has(expr)) return astCache.get(expr)!
  const ast = parse(expr)
  astCache.set(expr, ast)
  return ast
}
```

**2. 结果缓存（带依赖追踪）**

```typescript
interface CacheEntry {
  result: any
  dependencies: string[]  // 依赖的路径
}

const resultCache = new WeakMap<RuntimeContext, Map<string, CacheEntry>>()

function evaluateWithCache(expr: string, ctx: RuntimeContext): any {
  const cache = resultCache.get(ctx) || new Map()
  
  if (cache.has(expr)) {
    return cache.get(expr)!.result
  }
  
  const ast = parseWithCache(expr)
  const dependencies = extractDependencies(ast)  // ['user.name', 'todos.length']
  const result = evaluate(ast, ctx)
  
  cache.set(expr, { result, dependencies })
  resultCache.set(ctx, cache)
  
  return result
}
```

**3. 编译缓存（可选，后期优化）**

```typescript
// 简单表达式编译为直接访问函数
const compiledCache = new Map<string, Function>()

function compileSimpleExpression(ast: ESTree.Node): Function | null {
  // 字面量：{{ 42 }} → () => 42
  if (ast.type === 'Literal') {
    return () => ast.value
  }
  
  // 标识符：{{ user }} → (ctx) => ctx._get('user')
  if (ast.type === 'Identifier') {
    return (ctx) => ctx._get(ast.name)
  }
  
  // 静态成员访问：{{ user.name }} → (ctx) => ctx._get('user.name')
  const path = extractStaticPath(ast)
  if (path) {
    return (ctx) => ctx._get(path)
  }
  
  return null  // 复杂表达式，回退解释执行
}
```

#### 缓存失效机制

```typescript
function invalidateCache(path: string, ctx: RuntimeContext): void {
  const cache = resultCache.get(ctx)
  if (!cache) return
  
  // 清理所有依赖此路径的缓存
  for (const [expr, entry] of cache.entries()) {
    if (entry.dependencies.some(dep => isPathMatch(dep, path))) {
      cache.delete(expr)
    }
  }
}

// 路径匹配规则(严格按层级匹配,防止误匹配)
function isPathMatch(dependency: string, changedPath: string): boolean {
  // 'user.name' 匹配 'user' 或 'user.name'
  // 'todos.0.text' 匹配 'todos' 或 'todos.0' 或 'todos.0.text'
  // 但 'user' 不匹配 'userInfo'
  const depParts = dependency.split('.')
  const changeParts = changedPath.split('.')
  
  // 检查路径是否是父子关系
  const minLen = Math.min(depParts.length, changeParts.length)
  for (let i = 0; i < minLen; i++) {
    if (depParts[i] !== changeParts[i]) return false
  }
  return true
}
```

#### 依赖提取

```typescript
function extractDependencies(ast: ESTree.Node): string[] {
  const deps = new Set<string>()
  
  traverse(ast, {
    Identifier(node) {
      deps.add(node.name)
    },
    MemberExpression(node) {
      const path = extractStaticPath(node)
      if (path) deps.add(path)
    }
  })
  
  return Array.from(deps)
}
```

#### 安全沙箱

```typescript
function createSandbox(ctx: RuntimeContext, options: EvalOptions): any {
  const sandbox = Object.create(null)
  
  // 注入用户状态（只读保护，防止表达式修改状态）
  for (const key in ctx) {
    if (!key.startsWith('$') && !key.startsWith('_')) {
      // 深度冻结对象，确保表达式无法修改
      const value = ctx[key]
      sandbox[key] = typeof value === 'object' && value !== null
        ? deepFreeze(value)
        : value
    }
  }
  
  // 可选注入安全的全局函数（只读）
  if (options.allowGlobals) {
    sandbox.Math = Math
    sandbox.Date = Date
    sandbox.JSON = JSON
  }
  
  // 禁止访问危险对象
  Object.defineProperty(sandbox, 'window', { value: undefined, configurable: false })
  Object.defineProperty(sandbox, 'document', { value: undefined, configurable: false })
  Object.defineProperty(sandbox, 'globalThis', { value: undefined, configurable: false })
  Object.defineProperty(sandbox, 'eval', { value: undefined, configurable: false })
  Object.defineProperty(sandbox, 'Function', { value: undefined, configurable: false })
  
  return new Proxy(sandbox, {
    has: () => true,  // 阻止作用域逃逸
    get(target, key) {
      if (key === Symbol.unscopables) return undefined
      return target[key]
    },
    set() {
      // 禁止表达式修改沙箱中的任何值
      throw new ExpressionError(
        'Cannot modify state in expressions. Use actions instead.',
        'READ_ONLY_SANDBOX'
      )
    }
  })
}

// 深度冻结工具（防止嵌套对象被修改）
function deepFreeze<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) return obj
  
  Object.freeze(obj)
  
  Object.values(obj).forEach(value => {
    if (typeof value === 'object' && value !== null) {
      deepFreeze(value)
    }
  })
  
  return obj
}

// 表达式必须在严格模式下执行
function evaluateExpression(ast: ESTree.Node, ctx: RuntimeContext, options: EvalOptions): any {
  'use strict'  // 防止 this 逃逸到全局对象
  const sandbox = createSandbox(ctx, options)
  // ... 执行逻辑
}
```

**额外安全措施**:
- 表达式求值必须在严格模式下执行,防止 `this` 逃逸
- 冻结危险对象属性(`configurable: false`)
- 禁用 `eval`、`Function` 构造器
- AST 白名单验证(见下一节)

### 2.3 Action VM

动作虚拟机执行 Schema 中的指令序列，处理状态变更、事件触发、控制流等。

#### 动作执行器

```typescript
// 动作串行执行(保证顺序),错误时抛出异常
async function execute(actions: Action[], ctx: RuntimeContext): Promise<void> {
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    const handler = ctx.$methods[action.type]
    
    if (!handler) {
      throw new ActionError(
        `Unknown action type: ${action.type}`,
        action,
        { index: i, total: actions.length }
      )
    }
    
    try {
      await handler(ctx, action)
    } catch (error) {
      // 动作执行失败时抛出增强错误信息
      throw new ActionError(
        `Action ${action.type} failed at index ${i}: ${error.message}`,
        action,
        error,
        { index: i, total: actions.length }
      )
    }
  }
}

// 错误类型定义（P1: 完善错误处理体系）
class ActionError extends Error {
  code: string
  action: Action
  cause?: Error
  context?: any
  
  constructor(message: string, action: Action, cause?: Error, context?: any) {
    super(message)
    this.name = 'ActionError'
    this.code = 'ACTION_EXECUTION_ERROR'
    this.action = action
    this.cause = cause
    this.context = context
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      action: this.action,
      context: this.context,
      cause: this.cause?.message
    }
  }
}
```

**执行策略说明**:
- 动作按顺序串行执行(不并行)
- 一个动作失败则停止后续执行,抛出异常
- 调用方可在事件处理器级别捕获错误

#### 内置动作实现

**1. set - 修改状态**

```typescript
function handleSet(ctx: RuntimeContext, action: Action): void {
  const { path, value } = action
  const resolvedValue = typeof value === 'string' && value.startsWith('{{')
    ? evaluateExpression(value, ctx)
    : value
  ctx._set(path, resolvedValue)
}

// 使用示例
{ "type": "set", "path": "user.name", "value": "张三" }
{ "type": "set", "path": "count", "value": "{{ count + 1 }}" }
```

**2. emit - 触发事件**

```typescript
function handleEmit(ctx: RuntimeContext, action: Action): void {
  const { event, data } = action
  const resolvedData = data && typeof data === 'string' && data.startsWith('{{')
    ? evaluateExpression(data, ctx)
    : data
  ctx.$emit(event, resolvedData)
}

// 使用示例
{ "type": "emit", "event": "submit", "data": { "userId": "{{ user.id }}" } }
```

**3. if - 条件分支**

```typescript
async function handleIf(ctx: RuntimeContext, action: Action): Promise<void> {
  const { cond, then, else: elseBranch } = action
  const condition = evaluateExpression(cond, ctx)
  
  if (condition) {
    await execute(then || [], ctx)
  } else if (elseBranch) {
    await execute(elseBranch, ctx)
  }
}

// 使用示例
{
  "type": "if",
  "cond": "{{ user.age >= 18 }}",
  "then": [
    { "type": "set", "path": "canVote", "value": true }
  ],
  "else": [
    { "type": "set", "path": "canVote", "value": false }
  ]
}
```

**4. loop - 循环执行**

```typescript
// 循环上下文对象池（性能优化：复用对象，减少 GC 压力）
class LoopContextPool {
  private pool: RuntimeContext[] = []
  private maxSize = 100
  
  acquire(parentCtx: RuntimeContext, item: any, index: number): RuntimeContext {
    const ctx = this.pool.pop() || Object.create(parentCtx)
    
    // 重置循环变量
    ctx.$item = item
    ctx.$index = index
    
    return createProxy(ctx)
  }
  
  release(ctx: RuntimeContext): void {
    if (this.pool.length < this.maxSize) {
      // 清理循环变量
      delete ctx.$item
      delete ctx.$index
      this.pool.push(ctx)
    }
  }
}

const loopContextPool = new LoopContextPool()

async function handleLoop(ctx: RuntimeContext, action: Action): Promise<void> {
  const { items, do: body } = action
  const itemsValue = evaluateExpression(items, ctx)
  
  if (!Array.isArray(itemsValue)) {
    throw new ActionError(
      `Loop items must be an array, got ${typeof itemsValue}`,
      action
    )
  }
  
  for (let i = 0; i < itemsValue.length; i++) {
    // 从对象池获取上下文
    const loopCtx = loopContextPool.acquire(ctx, itemsValue[i], i)
    
    try {
      await execute(body, loopCtx)
    } finally {
      // 归还到对象池
      loopContextPool.release(loopCtx)
    }
  }
}

// 使用示例
{
  "type": "loop",
  "items": "{{ todos }}",
  "do": [
    { "type": "log", "message": "{{ $item.text }}" }
  ]
}
```

**循环上下文优化**:
- 使用对象池复用上下文对象，减少 GC 压力（P1 性能优化）
- 使用原型链继承父上下文，避免浅拷贝开销
- `$item`/`$index` 在子上下文中，不影响父上下文
- 子上下文修改状态会通过 `_set` 同步到父上下文

**5. call - 调用方法**

```typescript
async function handleCall(ctx: RuntimeContext, action: Action): Promise<any> {
  const { method, params } = action
  const fn = ctx.$methods[method]
  
  if (!fn) {
    throw new ActionError(`Method not found: ${method}`, action)
  }
  
  const resolvedParams = params && typeof params === 'object'
    ? resolveParams(params, ctx)
    : params
  
  return await fn(ctx, resolvedParams)
}

// 使用示例
{
  "type": "call",
  "method": "services.fetchUsers",
  "params": { "page": "{{ currentPage }}" }
}
```

**6. 列表操作动作**

```typescript
// push - 添加元素到数组末尾
function handlePush(ctx: RuntimeContext, action: Action): void {
  const { path, value } = action
  const arr = ctx._get(path)
  if (!Array.isArray(arr)) {
    throw new ActionError(`Path is not an array: ${path}`, action)
  }
  arr.push(value)
  ctx._set(path, arr)
}

// pop - 移除数组最后一个元素
function handlePop(ctx: RuntimeContext, action: Action): void {
  const { path } = action
  const arr = ctx._get(path)
  if (Array.isArray(arr)) {
    arr.pop()
    ctx._set(path, arr)
  }
}

// splice - 数组切片操作
function handleSplice(ctx: RuntimeContext, action: Action): void {
  const { path, start, deleteCount, items = [] } = action
  const arr = ctx._get(path)
  if (Array.isArray(arr)) {
    arr.splice(start, deleteCount, ...items)
    ctx._set(path, arr)
  }
}
```

#### 方法注册系统

```typescript
interface MethodMetadata {
  permissions?: string[]       // 权限声明
  description?: string          // 方法描述
}

// 内置动作名称列表（禁止覆盖）
const BUILTIN_ACTIONS = new Set([
  'set', 'emit', 'if', 'loop', 'call',
  'push', 'pop', 'shift', 'unshift', 'splice'
])

const methodRegistry = new Map<string, { handler: Function; meta: MethodMetadata }>()

function registerMethod(
  name: string,
  handler: Function,
  meta: MethodMetadata = {}
): void {
  // P0: 防止覆盖内置动作
  if (BUILTIN_ACTIONS.has(name)) {
    throw new RuntimeError(
      `Cannot register method "${name}": conflicts with builtin action`,
      'METHOD_NAME_CONFLICT'
    )
  }
  
  // P0: 推荐使用命名空间（如 'http.get'），防止命名冲突
  if (!name.includes('.')) {
    console.warn(
      `[Vario] Method "${name}" has no namespace. ` +
      `Consider using namespaced names like "myService.${name}" to avoid conflicts.`
    )
  }
  
  // 检查重复注册
  if (methodRegistry.has(name)) {
    console.warn(`[Vario] Method "${name}" is being overwritten`)
  }
  
  methodRegistry.set(name, { handler, meta })
}

// 注册到运行时上下文
function installMethods(ctx: RuntimeContext): void {
  for (const [name, { handler }] of methodRegistry.entries()) {
    ctx.$methods[name] = handler
  }
}

// 移除方法（用于测试或插件卸载）
function unregisterMethod(name: string): boolean {
  return methodRegistry.delete(name)
}
```

---

## 3. Schema Layer

### 3.1 Schema 类型定义

```typescript
interface Schema {
  component: string                    // 组件类型
  props?: Record<string, any>          // 静态属性
  model?: string | Record<string, string>  // 双向绑定
  events?: Record<string, Action[]>   // 事件处理器
  children?: Schema[] | string         // 子元素
  
  // 控制流（运行时处理）
  if?: string                          // 条件渲染
  loop?: {
    items: string                      // 数组表达式
    itemKey?: string                   // 唯一键字段
  }
}

interface Action {
  type: string                         // 动作类型（如 'set', 'emit', 'call'）
  [key: string]: any                   // 动作参数（根据 type 不同而不同）
}
```

### 3.2 Schema 校验器

```typescript
interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

function validateSchema(schema: Schema): ValidationResult {
  const errors: ValidationError[] = []
  
  // 结构校验
  if (!schema.component) {
    errors.push({ path: '/', message: 'Missing required field: component' })
  }
  
  // 表达式校验
  for (const [key, value] of Object.entries(schema.props || {})) {
    if (typeof value === 'string' && value.match(/^\{\{.*\}\}$/)) {
      try {
        const expr = value.slice(2, -2).trim()
        const ast = parse(expr)
        validateAST(ast)
      } catch (err) {
        errors.push({ path: `props.${key}`, message: err.message })
      }
    }
  }
  
  // 动作校验
  for (const instructions of Object.values(schema.events || {})) {
    validateInstructions(instructions, errors)
  }
  
  // 递归校验子元素
  if (Array.isArray(schema.children)) {
    schema.children.forEach((child, i) => {
      if (typeof child === 'object') {
        const result = validateSchema(child)
        errors.push(...result.errors.map(e => ({
          ...e,
          path: `children[${i}]${e.path}`
        })))
      }
    })
  }
  
  return { valid: errors.length === 0, errors }
}
```

---

## 4. Rendering Backend (Vue)

### 4.1 useVario API

#### Options 风格（推荐）

```typescript
interface UseVarioOptions<TState extends Record<string, any>> {
  // 状态初始化（类似 Vue 3 Composition API 的 reactive）
  state?: SafeState<TState>
  
  // 计算属性（类似 Vue computed）
  computed?: Record<string, (state: TState) => any>
  
  // 业务方法（类似 Vue methods）
  methods?: Record<string, (context: MethodContext<TState>) => any>
  
  // 双向绑定配置（非标准组件，如第三方 UI 库）
  modelBindings?: Record<string, ModelConfig>
  
  // 事件处理器
  onEmit?: (event: string, data: any) => void
  onError?: (error: Error) => void
  
  // 渲染选项
  rendererOptions?: { instance?: any }
}

interface MethodContext<TState> {
  state: TState       // 响应式状态
  params: any         // 方法参数
  event?: Event       // 事件对象（DOM 事件或自定义事件）
}
```

#### 实现要点

**1. 状态初始化与同步(防止循环触发)**

```typescript
function useVario<TState extends Record<string, any>>(
  schema: Schema | Ref<Schema>,
  options: UseVarioOptions<TState>
) {
  // 创建响应式状态（统一命名：state）
  const state = reactive(options.state || {} as TState)
  
  // 同步锁,防止双向同步死循环
  let syncing = false
  
  // 创建运行时上下文
  const ctx = ref<RuntimeContext<TState>>(
    createRuntimeContext<TState>({
      ...state,
      onStateChange(path, value) {
        if (syncing) return
        
        syncing = true
        try {
          // 运行时状态变更 → 同步到 Vue 状态
          const keys = path.split('.')
          let target: any = state
          for (let i = 0; i < keys.length - 1; i++) {
            target = target[keys[i]]
          }
          target[keys[keys.length - 1]] = value
          
          // 失效表达式缓存
          invalidateCache(path, ctx.value)
        } finally {
          syncing = false
        }
      }
    })
  )
  
  // Vue 状态 → 同步到运行时上下文
  watch(state, () => {
    if (syncing) return
    
    syncing = true
    try {
      for (const key in state) {
        ctx.value._set(key, (state as any)[key], { skipCallback: true })
      }
    } finally {
      syncing = false
    }
  }, { deep: true })
  
  return { vnode: vnodeRef, state, ctx }
}
```

**2. 计算属性**

```typescript
if (options.computed) {
  for (const [key, fn] of Object.entries(options.computed)) {
    const computedValue = computed(() => fn(state))
    
    // 同步到运行时上下文
    watch(computedValue, (val) => {
      ctx.value._set(key, val, { skipCallback: true })
    }, { immediate: true })
    
    // 添加到 state（只读访问）
    Object.defineProperty(state, key, {
      get: () => computedValue.value,
      enumerable: true,
      configurable: false  // 防止被重新定义
    })
  }
}
```

**3. 方法注册**

```typescript
if (options.methods) {
  for (const [key, fn] of Object.entries(options.methods)) {
    // 方法统一注册到 $methods
    ctx.value.$methods[key] = async (params: any) => {
      try {
        // 自动检测异步方法（无需 async 标记）
        const result = fn({ state, params, event: ctx.value.$event })
        return result instanceof Promise ? await result : result
      } catch (error) {
        // 方法执行错误传递给错误处理器
        options.onError?.(error as Error)
        throw error
      }
    }
  }
}
```

**4. 渲染调度**

```typescript
const vnodeRef = ref<VNode>()

function render() {
  try {
    vnodeRef.value = createVNode(schema, ctx.value, options.rendererOptions)
  } catch (err) {
    options.onError?.(err)
  }
}

// 监听 schema 变更
watch(() => schema, () => nextTick(render), { deep: true })

// 监听状态变更（通过 onStateChange 触发）
watch(state, () => nextTick(render), { deep: true })

// 初始渲染
render()

return { vnode: vnodeRef, state, ctx }
```

### 4.2 VNode 创建

```typescript
function createVNode(
  schema: Schema,
  ctx: RuntimeContext,
  options?: RendererOptions
): VNode {
  // 处理条件渲染
  if (schema.if) {
    const condition = evaluateExpression(schema.if, ctx)
    if (!condition) return createCommentVNode('v-if')
  }
  
  // 处理循环渲染
  if (schema.loop) {
    const items = evaluateExpression(schema.loop.items, ctx)
    if (!Array.isArray(items)) return createCommentVNode('v-for')
    
    return h(Fragment, items.map((item, index) => {
      // 创建循环子上下文(浅拷贝 + 代理保护)
      const loopCtx = createProxy({
        ...ctx,
        $item: item,
        $index: index
      })
      return createVNode({ ...schema, loop: undefined }, loopCtx, options)
    }))
  }
  
  // 解析组件
  const component = resolveComponent(schema.component, options)
  
  // 构建属性
  const props = buildProps(schema, ctx)
  
  // 处理双向绑定
  const modelBindings = buildModelBindings(schema, ctx, options)
  
  // 处理事件
  const events = buildEvents(schema, ctx)
  
  // 处理子元素
  const children = buildChildren(schema, ctx, options)
  
  return h(component, { ...props, ...modelBindings, ...events }, children)
}
```

### 4.3 双向绑定

```typescript
function buildModelBindings(
  schema: Schema,
  ctx: RuntimeContext,
  options?: RendererOptions
): Record<string, any> {
  if (!schema.model) return {}
  
  const bindings: Record<string, any> = {}
  
  // 单 model
  if (typeof schema.model === 'string') {
    const config = getModelConfig(schema.component, undefined, options)
    bindings[config.prop] = ctx._get(schema.model)
    bindings[config.event] = (value: any) => {
      ctx._set(schema.model as string, value)
    }
  }
  
  // 多 model（Vue 3.4+）
  if (typeof schema.model === 'object') {
    for (const [modelName, path] of Object.entries(schema.model)) {
      const config = getModelConfig(schema.component, modelName, options)
      bindings[config.prop] = ctx._get(path)
      bindings[config.event] = (value: any) => {
        ctx._set(path, value)
      }
    }
  }
  
  return bindings
}

// 模型配置
interface ModelConfig {
  prop: string    // 属性名
  event: string   // 事件名
}

function getModelConfig(
  component: string,
  modelName?: string,
  options?: RendererOptions
): ModelConfig {
  // 自定义配置（统一命名：modelBindings）
  const key = modelName ? `${component}:${modelName}` : component
  if (options?.modelBindings?.[key]) {
    return options.modelBindings[key]
  }
  
  // 默认配置
  if (modelName) {
    return {
      prop: modelName,
      event: `onUpdate:${modelName}`
    }
  }
  
  return {
    prop: 'modelValue',
    event: 'onUpdate:modelValue'
  }
}
```

---

## 5. 安全模型

### 5.1 安全分层

```
┌─────────────────────────────────────────────────┐
│ Expression Layer（严格沙箱）                     │
│ - 只读状态访问                                   │
│ - AST 白名单                                    │
│ - 无全局对象访问                                 │
│ - 步数/超时限制                                  │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ Method Layer（可控访问）                         │
│ - 白名单注册                                     │
│ - 声明权限后可访问全局对象                        │
│ - 异步操作支持                                   │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ Agent Output Layer（输出验证）                   │
│ - Schema 结构校验                                │
│ - 动作白名单验证                                 │
│ - 表达式注入防护                                 │
└─────────────────────────────────────────────────┘
```

### 5.2 表达式层安全

```typescript
const ALLOWED_AST_NODES = [
  'Literal',
  'Identifier',
  'MemberExpression',
  'BinaryExpression',
  'LogicalExpression',
  'ConditionalExpression',
  'UnaryExpression',
  'CallExpression',  // 仅白名单函数
  'ArrayExpression',
  'ObjectExpression'
]

const ALLOWED_FUNCTIONS = [
  // Math 函数
  'Math.floor', 'Math.ceil', 'Math.round', 'Math.abs',
  'Math.min', 'Math.max', 'Math.pow', 'Math.sqrt',
  
  // 数组只读方法
  'Array.map', 'Array.filter', 'Array.reduce', 'Array.find',
  'Array.some', 'Array.every', 'Array.slice', 'Array.concat',
  
  // 字符串方法
  'String.trim', 'String.toUpperCase', 'String.toLowerCase',
  'String.split', 'String.slice', 'String.substring'
]

function validateAST(ast: ESTree.Node): void {
  traverse(ast, {
    enter(node) {
      // 节点类型检查
      if (!ALLOWED_AST_NODES.includes(node.type)) {
        throw new ExpressionError(
          'Invalid AST node type: ' + node.type,
          'AST_VALIDATION'
        )
      }
      
      // 函数调用检查
      if (node.type === 'CallExpression') {
        const fnPath = extractFunctionPath(node.callee)
        if (!ALLOWED_FUNCTIONS.includes(fnPath)) {
          throw new ExpressionError(
            'Function not allowed: ' + fnPath,
            'FUNCTION_WHITELIST'
          )
        }
      }
      
      // 禁止访问危险属性
      if (node.type === 'MemberExpression') {
        const prop = node.property
        if (prop.type === 'Identifier' && 
            ['__proto__', 'constructor', 'prototype'].includes(prop.name)) {
          throw new ExpressionError(
            'Access to prototype chain is forbidden',
            'UNSAFE_ACCESS'
          )
        }
      }
      
      // ObjectExpression 额外校验(防止计算属性名绕过)
      if (node.type === 'ObjectExpression') {
        for (const prop of node.properties) {
          if (prop.type === 'Property' && prop.computed) {
            // 禁止计算属性名(可能注入 __proto__ 等)
            throw new ExpressionError(
              'Computed property names are not allowed',
              'UNSAFE_OBJECT'
            )
          }
        }
      }
    }
  })
}
```

### 5.3 方法层安全

```typescript
registerMethod('http.request', async (ctx, params) => {
  // 方法层可以访问全局 fetch
  const response = await fetch(params.url, params.options)
  return response.json()
}, {
  permissions: ['network'],
  description: '发起 HTTP 请求'
})

registerMethod('storage.set', (ctx, params) => {
  // 方法层可以访问 localStorage
  localStorage.setItem(params.key, JSON.stringify(params.value))
}, {
  permissions: ['storage'],
  description: '存储数据到 localStorage'
})
```

---

## 6. 性能优化

### 6.1 性能目标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 动作执行 | < 1ms/100ops | 原子指令批量执行 |
| 表达式求值（首次） | < 0.5ms | 含 AST 解析 + 校验 |
| 表达式求值（缓存） | < 0.05ms | 缓存命中直接返回 |
| 路径解析 | < 0.01ms | 路径缓存命中 |
| 状态更新 | < 0.1ms/属性 | 响应式系统开销 |
| 内存占用 | < 150KB/页面 | 运行时 + 缓存 |
| 启动时间 | < 100ms | 初始化 + 编译 |

### 6.2 优化策略

**1. 表达式优化**

- AST 缓存：按表达式字符串缓存解析结果
- 编译缓存：简单表达式编译为直接访问代码
- 结果缓存：按依赖路径缓存求值结果，精准失效

**2. 路径操作优化**

- 路径解析缓存：避免重复字符串分割
- 批量更新：微任务队列合并多次状态变更

**3. 渲染优化**

- 组件解析缓存：缓存全局组件查找结果
- VNode 复用：相同 Schema 复用 VNode
- 绑定函数缓存：避免重复创建事件处理器

**4. 内存管理**

- WeakMap 缓存：自动回收不再使用的缓存
- LRU 淘汰：限制缓存大小，优先淘汰最久未用项

---

## 7. 扩展机制

### 7.1 自定义方法

```typescript
registerMethod('http.get', async (ctx, action) => {
  const { url, params } = action
  const queryString = new URLSearchParams(params).toString()
  const response = await fetch(`${url}?${queryString}`)
  return response.json()
}, {
  permissions: ['network']
})

// Schema 中使用
{
  "type": "call",
  "method": "http.get",
  "params": {
    "url": "/api/users",
    "params": { "page": "{{ currentPage }}" }
  }
}
```

### 7.2 自定义组件

```typescript
// Vue 全局注册
app.component('CustomSelect', CustomSelect)

// Schema 中使用
{
  "component": "CustomSelect",
  "model": "selectedId",
  "props": {
    "options": "{{ userOptions }}"
  }
}
```

---

## 8. 完整示例

### 8.1 Todo App

```typescript
// .vario.ts
const { vnode, state } = useVario({
  component: 'div',
  children: [
    {
      component: 'ElInput',
      model: 'newTodoText',
      props: { placeholder: '输入待办事项' }
    },
    {
      component: 'ElButton',
      props: { type: 'primary' },
      children: '添加',
      events: {
        click: [
          { type: 'call', method: 'addTodo' }
        ]
      }
    },
    {
      component: 'div',
      loop: { items: '{{ todos }}', itemKey: 'id' },
      children: [
        {
          component: 'ElCheckbox',
          model: '$item.completed',
          children: '{{ $item.text }}'
        },
        {
          component: 'ElButton',
          props: { size: 'small' },
          children: '删除',
          events: {
            click: [
              { 
                type: 'call',
                method: 'removeTodo',
                params: { id: '{{ $item.id }}' }
              }
            ]
          }
        }
      ]
    }
  ]
}, {
  // P0: 统一命名 state（与 Vue 3 Composition API 一致）
  state: {
    todos: [] as Array<{ id: number; text: string; completed: boolean }>,
    newTodoText: ''
  },
  
  computed: {
    completedCount: (state) => state.todos.filter(t => t.completed).length
  },
  
  methods: {
    addTodo({ state }) {
      if (!state.newTodoText.trim()) return
      state.todos.push({
        id: Date.now(),
        text: state.newTodoText,
        completed: false
      })
      state.newTodoText = ''
    },
    
    removeTodo({ state, params }) {
      state.todos = state.todos.filter(t => t.id !== params.id)
    }
  },
  
  // P0: 统一命名 onEmit（更直观）
  onEmit(event, data) {
    console.log(`Event: ${event}`, data)
  },
  
  onError(error) {
    console.error('Vario error:', error)
  }
})
```

---

## 9. 总结

### 核心架构

- **4 层架构**：Core Runtime → Schema Layer → Rendering Backend → Tooling
- **3 个引擎**：Expression Engine、Action VM、Renderer
- **2 个边界**：表达式沙箱（严格）、方法层（可控）
- **1 个目标**：安全、高性能、易扩展的 UI 行为虚拟机

### 技术特点

1. **扁平化状态**：`ctx.user.name` 直接访问，无冗余命名空间
2. **两级缓存**：AST/结果(编译可选)缓存，最大化性能
3. **清晰安全边界**：表达式只读沙箱，方法层权限管理
4. **框架无关核心**：Core Runtime 不依赖任何 UI 框架
5. **渐进式增强**：从 Schema JSON 到 TypeScript defineSchema

### 实现路径

1. **Layer 1 Core Runtime**：RuntimeContext + Expression + Action VM + Method Registry
2. **Layer 2 Schema Layer**：Schema Types + Validator + Transform
3. **Layer 3 Vue Renderer**：useVario + VNode Factory + Bindings
4. **Layer 4 Tooling**：Dev Server + Build Plugin + Agent Skill

**Vario 提供一个安全、高性能、可扩展的 UI 行为中间层，特别适合 AI Agent 驱动的动态 UI 生成场景。**
