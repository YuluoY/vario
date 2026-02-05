<div align="center">

<img src="./play/public/logo-icon.svg" alt="Vario Logo" width="200" style="margin-bottom: -50px; margin-top: -50px;" />

# Vario

> Schema-First UI Behavior Runtime

[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue)](https://yuluoy.github.io/vario/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-orange)](https://pnpm.io/)

[在线演示](https://yuluoy.github.io/vario/) • [文档](https://yuluoy.github.io/vario/docs/) • [快速开始](https://yuluoy.github.io/vario/docs/guide/quick-start.html) • [Packages](#-packages)

</div>

---

Vario 是一个 Schema-First 的 UI 行为框架。你用 JSON Schema 描述 UI 结构、动作与表达式，核心运行时通过 Action VM 执行逻辑；渲染层将 Schema 映射到具体框架（当前支持 Vue 3，其他渲染器规划中）。

它的目标是把“页面结构、交互逻辑、运行时执行”解耦开来，形成一套稳定的 UI 行为中间层，便于复用、迁移和跨框架渲染。

## ✨ 特性概览

- **Schema DSL**：声明式描述 UI 结构与交互逻辑
- **Action VM**：统一执行 `call / set / emit / if / loop / batch` 等动作指令
- **安全表达式引擎**：白名单 + 依赖追踪 + 缓存加速
- **运行时上下文**：扁平状态 + `$` 系统 API + 路径读写
- **Vue 3 渲染器**：`useVario`、双向绑定、事件修饰符、refs/teleport/provide/inject
- **性能优化**：path-memo、列表项组件化、子树组件化、SchemaStore

## 🎯 Why Vario / 适用场景

Vario 适合把“UI 行为定义”从具体框架中抽离出来的场景，尤其是需要复用、迁移或跨端渲染的项目：

- **低代码/可配置 UI**：Schema 可直接作为配置协议，前后端协作更高效
- **跨框架复用**：同一套 Schema 可被不同渲染器消费（当前 Vue 3，其他规划中）
- **复杂表单/流程**：Action VM 统一处理逻辑分支、批量动作、异步调用
- **性能敏感 UI**：路径缓存、子树组件化、列表项组件化等针对大规模渲染优化
- **安全要求高**：表达式引擎受控执行，避免任意代码执行风险

## 🧩 架构一览

```
Schema (JSON DSL)
   ↓
Schema Layer (types / validator / normalizer / defineSchema)
   ↓
Core Runtime (RuntimeContext + Expression + Action VM)
   ↓
Renderer (Vue 3) → VNode
```

## 📦 Packages

| 包名 | 说明 |
|------|------|
| `@variojs/core` | 运行时核心：Action VM、表达式系统、RuntimeContext、Schema 查询工具 |
| `@variojs/schema` | Schema DSL：类型、验证、规范化、`defineSchema` |
| `@variojs/types` | 共享类型定义（消除跨包循环依赖） |
| `@variojs/vue` | Vue 3 渲染器与 `useVario` 组合式 API |
| `@variojs/cli` | CLI 工具（开发服务器与代码生成基础实现，部分命令仍在完善） |

## 🚀 快速开始

### 安装

```bash
pnpm add @variojs/vue @variojs/core @variojs/schema
```

### 示例（Vue 3）

```ts
import { useVario } from '@variojs/vue'
import type { Schema } from '@variojs/schema'

const schema: Schema = {
  type: 'div',
  children: [
    { type: 'input', model: 'name' },
    {
      type: 'button',
      events: {
        // 数组简写：['call', method, params?, modifiers?]
        'click.stop': ['call', 'submit', { params: ['{{ name }}'] }]
      },
      children: '提交'
    },
    {
      type: 'div',
      children: 'Hello {{ name }}'
    }
  ]
}

const { vnode, state } = useVario(schema, {
  state: { name: '' },
  methods: {
    submit: ({ params }) => {
      console.log('params:', params)
    }
  }
})
```

## 🧠 核心概念

- **Schema**：描述 UI 结构、事件与行为，支持表达式插值
- **Action**：VM 执行单位，`call` 调用方法、`set` 更新状态等
- **Expression**：受控表达式引擎，支持依赖追踪与缓存
- **RuntimeContext**：扁平化状态容器，提供 `_get / _set / $methods / $emit`

## ❓ FAQ

**Schema 和直接写组件有什么区别？**  
Schema 更像“UI 行为的中间表示”，它强调结构与逻辑的声明式描述，便于复用、序列化、跨端渲染与低代码配置。

**Action VM 做了什么？**  
Action VM 负责执行动作序列，统一处理 `call / set / emit / if / loop / batch` 等指令，并提供错误包装与超时保护。

**表达式是否安全？**  
表达式采用白名单机制与受控求值，避免直接执行任意代码，同时具备依赖追踪与缓存加速。

**是否只能用 Vue？**  
当前提供 Vue 3 渲染器；核心运行时与 Schema 是框架无关的，后续可扩展其他渲染器。

**CLI 现在能做什么？**  
CLI 已具备基础的开发服务器与代码生成入口，但部分命令仍在完善中。

## 📖 文档

- `docs/`：项目文档与指南
- `packages/vario-core/README.md`：核心运行时
- `packages/vario-schema/README.md`：Schema DSL
- `packages/vario-vue/README.md`：Vue 渲染器
- `packages/vario-types/README.md`：类型定义
- `packages/vario-cli/README.md`：CLI 工具

## 🛠️ 开发

```bash
pnpm install
pnpm build
pnpm test
pnpm start
```

## 🤝 贡献

请先阅读 `CONTRIBUTING.md`，再提交 Issue 或 PR。

## 📄 许可证

MIT
