# @vario/vue 概述

**@vario/vue** 是 Vario 的 Vue 3 渲染后端：把 **Schema** 转成 **Vue VNode**，并接入 Vue 的响应式、生命周期、Provide/Inject、Teleport、Transition、Keep-Alive 等。上层用 **useVario(schema, options)** 即可在组件内得到 `vnode` 和 `state`，无需直接使用 @vario/core 的 createRuntimeContext 或 VM。

## 职责边界

- **渲染**：Schema → 组件解析 → 属性/事件/子节点构建 → VNode 树
- **状态**：把 useVario 的 state 包成 Vue reactive，并与 Core 的 RuntimeContext 双向同步
- **路径与 model**：解析 model、路径栈、循环项，调用 Core 的 getPathValue/setPathValue 与循环上下文
- **表达式**：在 Vue 上下文中求值 `{{ }}`、cond、show，使用 Core 的表达式系统
- **事件**：把 Schema 的 events 转成 VM 的 execute，使用传入的 methods 与 ctx

不负责：Schema 的校验与规范化（@vario/schema）、表达式/VM 的底层实现（@vario/core）。

## 依赖与安装

```bash
pnpm add @variojs/vue @variojs/core @variojs/schema
```

Vue 需 ^3.4.0；若用 Element Plus 等组件库，需在应用里自己注册，并在 Schema 的 type 里写对应组件名。

## 文档导航（由浅入深）

| 主题 | 说明 |
|------|------|
| [快速开始](/guide/quick-start) | 5 分钟跑通 useVario + Schema |
| [状态管理](/guide/state) | state 与 ctx 的同步、依赖收集 |
| [Model 与路径](/guide/model-path) | model 写法、路径栈、scope、循环内路径 |
| [表达式](/guide/expression) | `{{ }}`、cond、show 在 Vue 中的使用 |
| [Vue 特性](/guide/vue-features) | Ref、生命周期、Provide/Inject、Teleport、Transition、Keep-Alive |
| [Computed 与 Watch](/guide/computed-watch) | 在组件里用 Vue 原生 API，通过 computed 注入 |
| [控制流](/guide/control-flow) | cond / show、loop |
| [事件处理](/guide/events) | events → VM 执行、methods 定义 |
| [性能优化](/guide/performance) | 缓存、批量更新、列表优化 |
| [API](/api/use-vario) | useVario 的 options 与返回值 |
| [类型](/api/types) | VueSchemaNode 等类型 |
| [最佳实践](/packages/vue/best-practices) | 建模、拆分、性能与可维护性 |

从 [快速开始](/guide/quick-start) 或 [状态管理](/guide/state) 按顺序看即可覆盖全部使用场景。
