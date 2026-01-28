# Vario 实施路线图

> **从 0 到 1 的完整实施计划**  
> 定义构建 Vario 的阶段、优先级与技术决策

---

## 1. 实施阶段

### 阶段 1：Core Runtime 基础

**核心目标**：建立框架无关的运行时基础设施

#### 1.1 RuntimeContext 实现

**任务**：
- 设计扁平化状态存储结构
- 实现 `_get` / `_set` 路径解析（含缓存）
- 实现系统 API（`$emit`、`$methods`、`$event`、`$item`、`$index`）
- 实现 `createProxy` 保护机制（禁止覆盖 `$`/`_` 前缀）
- 实现 `onStateChange` 钩子系统

**关键代码**：
```typescript
// runtime/create-context.ts
function createRuntimeContext<T>(options: RuntimeContextOptions): RuntimeContext<T>

// runtime/proxy.ts
function createProxy(ctx: RuntimeContext): RuntimeContext

// runtime/path.ts
function parsePathCached(path: string): PathSegment[]
function getPathValue(obj: any, path: string): any
function setPathValue(obj: any, path: string, value: any): void
```

#### 1.2 Expression System 实现

**任务**：
- 实现表达式解析器（基于 Babel parser）
- 实现 AST 白名单校验器
- 实现两级缓存系统（AST/结果，编译可选）
- 实现依赖提取算法
- 实现缓存失效机制
- 实现安全沙箱（`createSandbox`）
- 实现步数/超时保护

**关键代码**：
```typescript
// expression/parser.ts
function parse(expression: string): ESTree.Node

// expression/evaluator.ts
function evaluateExpression(expr: string, ctx: RuntimeContext, options?: EvalOptions): any

// expression/cache.ts
function getCachedResult(expr: string, ctx: RuntimeContext): any | undefined
function setCachedResult(expr: string, ctx: RuntimeContext, result: any, deps: string[]): void
function invalidateCache(path: string, ctx: RuntimeContext): void

// expression/compiler.ts
function compileExpression(ast: ESTree.Node): Function | null

// expression/whitelist.ts
function validateAST(ast: ESTree.Node): void
```

#### 1.3 Action VM 实现

**任务**：
- 实现动作执行器（`execute`）
- 实现内置动作处理器（`set`、`emit`、`if`、`loop`、`call`）
- 实现列表操作指令（`push`、`pop`、`shift`、`unshift`、`splice`）
- 实现方法注册系统（`registerMethod`）
- 实现错误处理链

**关键代码**：
```typescript
// vm/executor.ts
async function execute(instructions: Action[], ctx: RuntimeContext): Promise<void>

// vm/handlers.ts
function handleSet(ctx: RuntimeContext, ins: Instruction): void
function handleEmit(ctx: RuntimeContext, ins: Instruction): void
function handleIf(ctx: RuntimeContext, ins: Instruction): Promise<void>
function handleLoop(ctx: RuntimeContext, ins: Instruction): Promise<void>
function handleCall(ctx: RuntimeContext, ins: Instruction): Promise<any>

// vm/registry.ts
function registerMethod(name: string, handler: Function, meta?: MethodMetadata): void
```

---

### 阶段 2：Schema Layer

**核心目标**：建立 Schema 定义、校验与转换体系

#### 2.1 Schema 类型定义

**任务**：
- 定义 Schema 核心类型（`Schema`、`Instruction`、`Expression`）
- 定义控制流类型（`IfSchema`、`LoopSchema`）
- 定义双向绑定类型（`ModelConfig`）
- 提供完整 TypeScript 类型推导

**关键代码**：
```typescript
// schema/types.ts
interface Schema {
  component: string
  props?: Record<string, any>
  model?: string | Record<string, string>
  events?: Record<string, Action[]>
  children?: Schema[] | string
  if?: string
  loop?: { items: string; itemKey?: string }
}

interface Action {
  type: string
  [key: string]: any
}
```

#### 2.2 Schema 校验器

**任务**：
- 实现结构校验（必填字段、类型检查）
- 实现表达式校验（语法检查、白名单验证）
- 实现指令校验（参数完整性）
- 实现递归校验（子元素）

**关键代码**：
```typescript
// schema/validator.ts
function validateSchema(schema: Schema): ValidationResult
function validateInstructions(instructions: Action[]): ValidationError[]
```

#### 2.3 defineSchema 转换器

**任务**：
- 实现 `defineSchema` API
- 实现配置验证
- 实现编译期转换（配置 → 纯 Schema JSON）
- 提供类型推导支持

**关键代码**：
```typescript
// schema/define.ts
function defineSchema<TState, TServices>(
  config: VarioViewConfig<TState, TServices>
): VarioView
```

---

### 阶段 3：Vue Rendering Backend

**核心目标**：实现 Vue 3 集成与渲染

#### 3.1 useVario Composable

**任务**：
- 实现 Options 风格 API（`state`、`computed`、`methods`）
- 实现 Composition 风格 API（`state`、`computed`、`methods`）
- 实现状态双向同步（Vue `reactive` ↔ RuntimeContext）
- 实现计算属性集成
- 实现方法注册与参数化（自动异步检测）
- 实现渲染调度（`nextTick`）
- 实现错误处理（`onError`）

**关键代码**：
```typescript
// vue/composable.ts
function useVario<TState extends Record<string, any>>(
  schema: Schema | Ref<Schema>,
  options: UseVarioOptions<TState>
): UseVarioReturn<TState>
```

#### 3.2 VNode 工厂

**任务**：
- 实现 Schema → VNode 转换
- 实现条件渲染（`if`）
- 实现循环渲染（`loop`）
- 实现组件解析缓存
- 实现属性构建优化

**关键代码**：
```typescript
// vue/renderer.ts
function createVNode(
  schema: Schema,
  ctx: RuntimeContext,
  options?: RendererOptions
): VNode
```

#### 3.3 双向绑定系统

**任务**：
- 实现单 model 绑定（`model: 'field'`）
- 实现多 model 绑定（`model:name: 'field'`，Vue 3.4+）
- 实现自定义绑定配置（非标准组件）
- 实现绑定函数缓存

**关键代码**：
```typescript
// vue/bindings.ts
function buildModelBindings(
  schema: Schema,
  ctx: RuntimeContext,
  options?: RendererOptions
): Record<string, any>

function getModelConfig(
  component: string,
  modelName?: string,
  options?: RendererOptions
): ModelConfig
```

---

### 阶段 4：Tooling & Integration

**核心目标**：提供开发工具与 AI Agent 集成

#### 4.1 开发服务器

**任务**：
- 实现 `.vario.ts` 文件监听
- 实现热模块替换（HMR）
- 实现开发时类型提示
- 集成 Vue DevTools

**关键代码**：
```typescript
// cli/dev-server.ts
function createDevServer(options: DevServerOptions): ViteDevServer
```

#### 4.2 构建插件

**任务**：
- 实现 Vite 插件（`vite-plugin-vario`）
- 实现文件转换（`.vario.ts` → Schema JSON）
- 实现生产环境优化（Tree shaking、代码分割）

**关键代码**：
```typescript
// cli/vite-plugin.ts
function varioPlugin(options?: VarioPluginOptions): Plugin
```

#### 4.3 Agent Skill

**任务**：
- 编写 Agent 技能定义（Schema 生成规则）
- 实现输出验证器（Schema 校验、指令白名单）
- 实现表达式注入防护
- 提供 Few-shot 示例

**关键代码**：
```typescript
// agent/skill.ts
function validateAgentOutput(schema: Schema): ValidationResult
function sanitizeExpression(expr: string): string
```

---

## 2. 技术优先级

### P0（核心基础，必须优先）

**Layer 1: Core Runtime**
- RuntimeContext 实现（扁平化状态、路径解析、代理保护）
- Expression System（AST 校验、沙箱、两级缓存）
- Action VM（执行器、内置动作、方法注册）

**Layer 2: Schema Layer**
- Schema 类型定义
- Schema 校验器

### P1（开发体验，高优先级）

**Layer 3: Vue Renderer**
- useVario API（Options 风格、Composition 风格）
- VNode 工厂（Schema → VNode 转换）
- 双向绑定系统（单 model、多 model）

**Layer 2: Schema Layer**
- defineSchema 转换器

### P2（扩展能力，中优先级）

**Layer 1: Core Runtime**
- Method Registry（方法注册、权限管理）

**Layer 4: Tooling**
- 开发服务器（HMR、类型提示）
- 构建插件（Vite 插件）

### P3（高级特性，低优先级）

**Layer 4: Tooling**
- Agent Skill（技能定义、输出验证）

**多框架支持**
- React Renderer
- 原生移动端 Renderer

---

## 3. 技术决策

### 3.1 架构决策

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 状态设计 | 扁平化（无 `models.*`） | 更自然的访问方式，符合开发直觉 |
| 系统 API 标识 | `$` 前缀 | 清晰区分用户状态与系统功能，避免命名冲突 |
| 命名统一 | `state`/`onEmit`/`modelBindings` | 与 Vue 3 Composition API 保持一致 |
| 表达式引擎 | 基于 Babel parser | 完整 JavaScript 语法支持，成熟稳定 |
| 沙箱隔离 | Proxy + AST 白名单 + 只读冻结 | 三重保护，表达式层严格安全 |
| 缓存策略 | 两级缓存（AST/结果） | 最大化性能，精准失效 |
| 响应式系统 | 集成 Vue reactive | 利用 Vue 成熟的响应式基础设施 |
| 渲染调度 | `nextTick` | 批量更新，减少重复渲染 |
| 错误处理 | 统一错误类 + 上下文信息 | 提供完整错误堆栈和调试信息 |

### 3.2 安全决策

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 表达式全局访问 | 默认拒绝 | 严格沙箱，最大化安全 |
| 沙箱只读保护 | `deepFreeze` + Proxy.set 拦截 | 确保表达式无法修改状态 |
| 方法全局访问 | 白名单 + 权限声明 | 可控访问，支持必要的全局操作 |
| 方法命名冲突 | 禁止覆盖内置动作 + 命名空间推荐 | 避免与 set/emit/if 等冲突 |
| AST 节点限制 | 白名单机制 | 仅允许安全的语法节点 |
| 函数调用限制 | 白名单函数 | 禁止 `eval`、`Function` 等危险函数 |
| 对象字面量 | 禁止计算属性名 | 防止 `__proto__` 注入 |
| 执行步数限制 | 默认 1000 步 | 防止死循环 |
| 超时保护 | 可选配置 | 防止长时间阻塞 |

### 3.3 性能决策

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 表达式缓存 | 两级缓存 | AST/结果两级缓存(编译可选)，最大化复用 |
| 路径解析 | Map 缓存 | 避免重复字符串分割 |
| 循环上下文 | 对象池（P1 优化） | 复用对象，减少 GC 压力 |
| 组件解析 | 缓存 | 避免重复查找全局组件 |
| 绑定函数 | 缓存 | 避免重复创建闭包 |
| 批量更新 | 微任务队列 | 合并多次状态变更 |
| 内存管理 | WeakMap | 自动回收不再使用的缓存 |

---

## 4. 实施策略

### 4.1 开发顺序

**1. 核心运行时基础（P0）**
- 从底层开始，确保基础设施稳固
- 顺序：RuntimeContext → Expression → Action VM

**2. Schema 层（P0 → P1）**
- 先类型定义，后校验，最后转换
- 顺序：Types → Validator → Transform

**3. Vue 渲染（P1）**
- 先基础渲染，后高级特性
- 顺序：useVario → VNode Factory → Bindings

**4. 工具链（P2）**
- 先开发工具，后生产工具
- 顺序：Dev Server → Build Plugin → Agent Skill

### 4.2 测试策略

**单元测试**
- 每个模块独立测试
- 覆盖率目标：> 90%

**集成测试**
- 端到端场景测试
- 覆盖核心用户流程

**性能测试**
- 基准测试（Benchmark）
- 压力测试（大数据、深层嵌套）

**安全测试**
- 表达式注入测试
- 动作滥用测试
- 权限绕过测试

### 4.3 文档策略

**API 文档**
- 每个公开 API 都有文档
- 包含类型定义、参数说明、示例代码

**设计文档**
- 架构设计文档（本文档）
- 实现指南（vario-implementation.md）

**教程文档**
- 快速开始指南
- 最佳实践
- 常见问题

---

## 5. 风险管理

### 5.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 性能不达标 | 高 | 提前建立基准测试，持续优化 |
| 安全漏洞 | 高 | 严格 AST 白名单，渗透测试 |
| 类型推导复杂 | 中 | 投入时间设计泛型系统 |
| 缓存一致性 | 中 | 精准失效机制，完善测试 |

### 5.2 项目风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 时间估算不足 | 中 | 分阶段交付，灵活调整 |
| 跨框架复杂度 | 中 | 先聚焦 Vue，后扩展 React |
| 社区接受度 | 低 | 充分文档，示例项目 |

---

## 6. 成功标准

### 6.1 技术指标

- ✅ 指令执行：< 1ms/100ops
- ✅ 表达式求值（首次）：< 0.5ms
- ✅ 表达式求值（缓存）：< 0.05ms
- ✅ 路径解析：< 0.01ms
- ✅ 包大小：Core < 20KB gzipped
- ✅ 测试覆盖率：> 90%

### 6.2 安全指标

- ✅ 表达式沙箱：100% 隔离全局对象 + 只读保护
- ✅ AST 白名单：仅允许安全节点 + 禁止计算属性名
- ✅ 方法权限：100% 白名单机制 + 命名空间隔离
- ✅ 类型安全：RuntimeContext 泛型约束，防止$/_冲突
- ✅ 渗透测试：0 高危漏洞

### 6.3 开发体验指标

- ✅ 入门时间：< 15 分钟
- ✅ 类型提示：100% 公开 API
- ✅ 文档完整性：100% 功能覆盖
- ✅ 错误信息：清晰可操作

---

## 7. 总结

### 实施路径

```
Phase 1: Core Runtime (P0)
    ↓
Phase 2: Schema Layer (P0 → P1)
    ↓
Phase 3: Vue Renderer (P1)
    ↓
Phase 4: Tooling (P2)
```

### 关键里程碑

1. **Core Runtime 完成**：可以执行基础动作和表达式
2. **Schema Layer 完成**：可以校验和转换 Schema
3. **Vue Renderer 完成**：可以渲染完整的 Vue 应用
4. **1.0 发布**：完整功能、文档、测试

### 核心价值

- **安全**：三重保护（AST白名单 + 沙箱隔离 + 只读冻结）+ 方法权限管理
- **类型安全**：泛型约束防止命名冲突，完整的类型推导支持
- **高性能**：两级缓存 + 对象池优化，达到生产环境要求
- **易扩展**：方法注册系统 + 命名空间隔离，支持业务定制
- **好用**：符合 Vue 3 Composition API 心智模型，零学习成本
- **完善错误处理**：统一错误类型 + 上下文信息，便于调试
- **跨框架**：核心运行时框架无关，可适配多种渲染后端

**Vario 提供一个从 0 到 1 可落地的技术方案，为 AI Agent 驱动的动态 UI 生成提供坚实基础。**
