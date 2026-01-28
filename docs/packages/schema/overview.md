# @vario/schema 概述

**@vario/schema** 提供 Vario 的 Schema DSL 支持：类型定义、运行时校验、规范化与 **defineSchema**。渲染后端（如 @vario/vue）消费的是“已校验、可规范化”的 Schema，Core 只负责表达式与 VM，不关心 Schema 长什么样。

## 职责边界

- **类型**：SchemaNode、LoopConfig、ModelScopeConfig、Schema、以及 defineSchema 的 InferStateType / InferServicesFromConfig
- **验证**：validateSchema / validateSchemaNode / validateSchemaWithResult，含结构、表达式、路径
- **规范化**：normalizeSchema / normalizeSchemaNode，统一格式并带缓存
- **defineSchema**：把“状态 + 服务 + schema 函数”编译成纯 Schema，并做校验与类型推导

不负责：求值、VM 执行、UI 渲染（这些在 Core 与各渲染包）。

## 依赖

```bash
pnpm add @variojs/schema @variojs/core
```

Core 用于表达式校验与 RuntimeContext 类型；若只做类型导入或离线校验，理论上可仅装 @variojs/schema（类型上可能依赖 Core 的 Action、RuntimeContext）。

## 文档导航

| 主题 | 说明 |
|------|------|
| [类型与 Schema 节点](/packages/schema/types) | type / props / children / events / cond / show / loop / model |
| [验证](/packages/schema/validation) | validateSchema、选项、SchemaValidationError |
| [规范化](/packages/schema/normalization) | normalizeSchema、缓存、使用场景 |
| [defineSchema](/packages/schema/define-schema) | 配置、schema 函数、类型推导、与 useVario 的配合 |
| [API](/packages/schema/api) | 导出汇总 |
| [最佳实践](/packages/schema/best-practices) | 编写与校验 Schema 的实践建议 |

从 [类型与 Schema 节点](/packages/schema/types) 开始，由浅入深即可。
