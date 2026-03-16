# Vario — 项目指令

> 迁移说明：本文件由 `.github/copilot-instructions.md` 迁移而来，统一收敛到 `.github/instructions/*.instructions.md`。

## 项目概述

Vario 是一个 **Schema-First UI 行为运行时**：用 JSON Schema 描述 UI 结构与交互，通过 Action VM 执行逻辑，渲染层（当前 Vue 3）将 Schema 映射为 VNode。三层完全解耦：Schema DSL → Core Runtime → Renderer。

```
Schema (JSON DSL)
   ↓
@variojs/schema  — 类型、验证、规范化、defineSchema
   ↓
@variojs/core    — RuntimeContext + ExpressionEngine + Action VM
   ↓
@variojs/vue     — useVario + VNode 渲染
```

## 包结构与依赖顺序

| 包 | 职责 |
|---|---|
| `@variojs/types` | 跨包共享类型（无业务逻辑，消除循环依赖） |
| `@variojs/core` | Action VM (`execute`)、表达式引擎、`createRuntimeContext`、path 工具 |
| `@variojs/schema` | `defineSchema`、Schema 验证/规范化 |
| `@variojs/vue` | `useVario` 组合式 API、Vue 3 渲染器、VNode 插件系统 |
| `@variojs/cli` | 开发服务器（文件监听 + 自动验证 + 代码生成）、Schema 验证、类型生成工具 |

**构建顺序约束**：`types → core/schema（JS 先行，DTS 第二轮）→ vue → cli`。构建脚本 [`scripts/build.mjs`](../scripts/build.mjs) 自动处理两轮构建（第一轮只出 JS，第二轮才生成 DTS）。

## 关键开发命令

```bash
pnpm start              # 构建 packages 后同时启动 play(:5173) 和 docs(:5174)
pnpm dev                # 跳过构建直接启动（packages 已构建时使用）
pnpm build              # 两轮构建所有包（JS → DTS）
pnpm build:clean        # 先清理 dist 再构建
pnpm test               # 运行所有包的单元测试
pnpm test:integration   # 集成测试（vitest.config.integration.ts）
```

单包操作：
```bash
pnpm --filter @variojs/core build
pnpm --filter @variojs/core test:watch
```

## 核心设计模式

### Schema 节点 & `defineSchema`（推荐写法）
```typescript
import { defineSchema } from '@variojs/schema'

const view = defineSchema({
  state: { count: 0 },
  services: { increment: (ctx) => ctx._set('count', ctx._get('count') + 1) },
  schema: () => ({
    type: 'button',
    events: { click: { type: 'call', method: 'increment' } },
    children: '计数: {{ count }}'
  })
})
```

### Action VM 指令集
支持：`call | set | emit | if | loop | batch`。在 `packages/vario-core/src/vm/` 中实现。

### 表达式语法
模板中用 `{{ expr }}`，支持可选链、三元、白名单函数（`Math.*`、`Array.*`）。**禁止任意代码执行**——沙箱白名单机制。

### RuntimeContext 状态约定
- 状态扁平化访问：`ctx.count`（无 `models.` 前缀）
- 系统 API 使用 `_` 前缀：`ctx._set()`, `ctx._get()`, `ctx.$emit()`
- 循环上下文通过 `createLoopContext` / `releaseLoopContext` 管理（对象池复用）

## 架构约束

- `@variojs/types` 是唯一的共享类型来源，不得在其中引入业务逻辑
- `@variojs/core` **不依赖 Vue**，保持框架无关
- `@variojs/schema` 与 `@variojs/core` 存在相互引用，由构建脚本两轮构建解决
- 各包以 ESM 输出（`tsup`，`format: ['esm']`，`target: 'es2022'`）

## 测试约定

- 单包测试在 `packages/*/src/__tests__/` 或 `packages/*/__tests__/` 下
- 集成测试在 `tests/integration/` 下，使用独立配置 `vitest.config.integration.ts`
- 环境为 `node`（非浏览器）
- 当前测试规模：690 单元测试（core 216 + schema 35 + vue 433 + cli 6）+ 42 集成测试（8 个文件）

## 关键文件参考

- `packages/vario-core/src/index.ts` — core 公共 API 入口
- `packages/vario-core/src/vm/` — Action VM 实现
- `packages/vario-core/src/expression/README.md` — 表达式引擎设计文档
- `packages/vario-vue/src/` — Vue 3 渲染器与 `useVario`
- `packages/vario-vue/src/plugins/` — VNode 插件系统（lifecycle/keep-alive/transition/teleport）
- `play/src/` — 可运行示例（演练场）
