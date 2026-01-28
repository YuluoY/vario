# @vario/core 概述

**@vario/core** 是 Vario 的框架无关运行时，提供状态、表达式求值、指令执行和路径工具，被 Schema 层与各渲染后端（如 @vario/vue）依赖。

## 职责边界

- **RuntimeContext**：扁平化状态 + `_get` / `_set` + 方法表 + 事件发射，是“单一事实来源”
- **表达式系统**：解析、校验 AST、求值 `{{ expr }}`，带白名单与沙箱
- **Action VM**：按 `type` 派发并执行 `set`、`call`、`if`、`loop`、`batch` 等指令
- **路径与循环**：`parsePath`、`getPathValue`、`setPathValue`、`createLoopContext` / `releaseLoopContext`

不负责：UI 渲染、框架绑定、Schema 校验与规范化（这些在 @vario/schema、@vario/vue 等包）。

## 核心概念速览

| 概念 | 作用 | 文档 |
|------|------|------|
| RuntimeContext | 状态读写、方法调用、事件派发的统一上下文 | [RuntimeContext](/packages/core/runtime-context) |
| 表达式 | 安全求值 `count > 0`、`user.name` 等 | [表达式系统](/packages/core/expression) |
| Action VM | 执行 `set` / `call` / `if` / `loop` / `batch` 等 | [Action VM](/packages/core/action-vm) |
| 路径与循环 | 路径解析、取值/设值、循环上下文池 | [路径与循环上下文](/packages/core/path-and-loop) |

## 安装与依赖

```bash
pnpm add @variojs/core
```

一般通过 **@vario/vue** 或 **@vario/schema** 间接使用；若要做自定义渲染后端或脚本化逻辑，可直接使用本包 API。接下来从 [RuntimeContext](/packages/core/runtime-context) 由浅入深学习。
