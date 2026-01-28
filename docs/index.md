# Vario 介绍

Vario 是**声明式 UI 行为框架**：用 JSON Schema DSL 描述 UI 结构、绑定与事件，由框架无关的核心运行时（IR + VM）执行，再通过 Vue、React 等渲染后端呈现。

## 为什么用 Vario？

- **声明式**：Schema 即文档，逻辑与实现分离，易维护、易协作
- **框架无关**：Core 不依赖 Vue/React，一次定义可多端、多框架复用
- **类型安全**：TypeScript 贯穿 Schema、状态、方法，减少运行时错误
- **安全可控**：表达式白名单与沙箱，避免 `eval` 式风险
- **可观测、可扩展**：统一的事件与状态变化回调，便于埋点与扩展

## 架构与包划分

```
┌─────────────────────────────────────────────────────────────┐
│ 渲染后端 (Rendering)                                         │
│ @vario/vue (Vue 3) · React [规划中]                          │
├─────────────────────────────────────────────────────────────┤
│ Schema 层                                                    │
│ @vario/schema  类型 / 验证 / 规范化 / defineSchema           │
├─────────────────────────────────────────────────────────────┤
│ 核心运行时 (Core)                                            │
│ @vario/core    RuntimeContext · 表达式 · Action VM · 路径工具 │
└─────────────────────────────────────────────────────────────┘
```

| 包 | 职责 | 典型用法 |
|----|------|----------|
| **@vario/core** | 状态、表达式、指令执行、路径与循环上下文 | 所有基于 Vario 的应用都间接依赖 |
| **@vario/schema** | Schema 类型、校验、规范化、defineSchema | 定义界面结构、约束与类型推导 |
| **@vario/vue** | 把 Schema 渲染成 Vue 组件树 | Vue 项目里用 `useVario(schema, options)` |
| **@vario/cli** | 开发服务器、代码生成、校验 | 本地开发、脚手架与流水线 |

## 由浅入深怎么学？

1. **快速跑通**：[快速开始](/guide/quick-start) 里用 `@vario/vue` + 一份 Schema 渲染一个简单表单，建立「Schema → 界面」的直观感受。
2. **理解 Core**：掌握 [RuntimeContext](/packages/core/runtime-context)、[表达式](/packages/core/expression)、[Action VM](/packages/core/action-vm)，明白「状态从哪来、事件如何触发指令」。
3. **吃透 Schema**：从 [类型与节点](/packages/schema/types) 到 [验证](/packages/schema/validation)、[defineSchema](/packages/schema/define-schema)，写出可维护、可校验的 Schema。
4. **用好 Vue 集成**：在 [@vario/vue 概述](/packages/vue/overview) 与各指南中掌握状态、model、表达式、控制流与 Vue 特性映射。
5. **提效工具**：用 [CLI](/packages/cli/overview) 做本地开发与生成代码。

每个包文档都按「概述 → 核心概念 → API → 最佳实践」组织，由浅入深、由简单到复杂。

## 安装

按需安装渲染后端与 Core/Schema：

```bash
# Vue 项目典型依赖
pnpm add @variojs/vue @variojs/core @variojs/schema
```

仅做 Schema 校验或类型推导时可只装：

```bash
pnpm add @variojs/schema @variojs/core
```

[快速开始 →](/guide/quick-start)
