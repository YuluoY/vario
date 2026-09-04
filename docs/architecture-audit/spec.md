# Vario 中大型低代码核心审计规格

> 日期：2026-08-31 | 作者：huyongle | 状态：已确认  
> 关联入口：[审计总览](./index.md)

## 背景与动机

Vario 希望成为 Schema-First UI 的运行时核心，并落地到真实 Vue 项目、可编辑画布和多页面低代码平台。对这类系统，“能生成 VNode”不等于“能支撑中大型项目”：正确性、更新粒度、资源生命周期、Schema 演进、安全边界和故障定位必须同时成立。

本审计回答以下决策问题：

1. 当前包边界和依赖方向是否足以让多个团队长期协作？
2. 简单、复杂、宽树、深树、循环、高频更新与多页面场景的实际复杂度是什么？
3. Vue 响应式与 Vario 自有缓存/调度是否协同，还是重复工作？
4. Schema 来自画布或租户时，验证、表达式、action 和状态路径是否构成可信边界？
5. 保持现有使用方式不变，内部怎样演进到可灰度、可回滚的生产架构？

## 角色与期望

| 编号 | 角色 | 期望 | 验收线索 |
|---|---|---|---|
| US-1 | Vue 应用开发者 | 现有公共导出、类型和 `useVario` 调用不因内核重构而改写 | COMP-1～COMP-6 |
| US-2 | 低代码画布开发者 | 节点 patch、撤销/重做、预览刷新可预测 | CANVAS-1～CANVAS-5 |
| US-3 | 物料开发者 | props/events/slots/model 与版本契约可校验 | CONTRACT-1～CONTRACT-7 |
| US-4 | 平台运行时开发者 | 单页、多页、隐藏页与销毁页有资源边界 | LIFE-1～LIFE-5 |
| US-5 | 安全负责人 | 不可信 Schema 不能越权访问或修改宿主能力 | SEC-1～SEC-8 |
| US-6 | 发布维护者 | 每个发布包来自已通过测试的当前源码 | RELEASE-1～RELEASE-8 |

## 目标

- 给出基于源码和可复现实验的生产适用性结论。
- 识别所有会阻止中大型低代码生产使用的 P0/P1 问题。
- 明确简单、中型、大型、深嵌套、循环与多页面的容量边界。
- 设计保留完整 public API surface 和安全合法使用方式的目标架构与分阶段迁移方案。
- 给出能进入 CI 的量化正确性、安全、性能和内存门禁。

## 非目标

- 不在本轮一次性完成整个运行时重写。
- 不用某一台机器的毫秒数承诺所有终端性能。
- 不评估具体业务组件库、图表库或富文本编辑器自身的渲染成本。
- 不把现有文档中的功能描述当成已经实现的事实。
- 不承诺 React 或其他尚未存在的渲染后端能力。

## 功能需求

### FR-1: 源码架构审计

- **优先级**：P0
- **触发条件**：评估当前工作树能否成为中大型 Vue/低代码项目内核。
- **预期行为**：还原 packages、Schema、Runtime、VM、Vue renderer 与 CLI 的真实依赖和调用链。
- **边界条件**：注释与实现冲突时，以执行结果为准；当前未提交工作树必须计入。

### FR-2: 分级性能与正确性验证

- **优先级**：P0
- **触发条件**：运行时在真实 Vue mount/patch 中处理不同规模和结构的 Schema。
- **预期行为**：覆盖简单、宽树、深树、loop、局部更新、画布 mutation 与多页面驻留，给出正确性和复杂度结论。
- **边界条件**：必须区分 VNode 构造、Vue patch 和浏览器 DOM；功能错误场景不得只报告毫秒。

### FR-3: 低代码生产边界判断

- **优先级**：P0
- **触发条件**：Schema 来自画布、第三方物料、多租户存储或远程下发。
- **预期行为**：判断可信/不可信 Schema、画布、多页面、物料扩展、SSR 与发布链是否可用。
- **边界条件**：任何 P0 安全或正确性风险存在时，结论不得标记“生产就绪”。

### FR-4: 兼容目标架构

- **优先级**：P0
- **触发条件**：实施安全、契约、响应式、渲染粒度或多页面内部重构。
- **预期行为**：保持现有包根出口、子出口、值/类型导出、构造器、overload、返回字段和安全合法行为；`useVario/defineSchema/execute` 主入口使用方式不变。
- **边界条件**：不得通过一次性整体重写规避兼容性验证。

### FR-5: 实施与验收

- **优先级**：P0
- **触发条件**：审计结论需要转换为可分工、可灰度、可量化验收的工程任务。
- **预期行为**：按阶段列出修改模块、测试、性能预算、发布门禁与回滚策略。
- **边界条件**：每个任务必须能追溯到源码证据或实测断点。

## 非功能性需求

### 性能

- 关注更新复杂度、组件 render 数、DOM 数、cache cliff、长任务和多页面线性成本。
- 目标预算由 [验收门禁](./acceptance-gates.md) 定义，不能只用平均耗时。

### 安全

- Schema、表达式、action、path 按不可信输入审计。
- 明确 capability、deadline、step、cancel、prototype 与敏感 diagnostic 边界。

### 可维护性

- 包依赖必须为 DAG。
- Schema 只有一个契约来源。
- 所有 registry/cache/pool 有 Engine/Session 生命周期。
- 关键 public API 与迁移有 snapshot/golden fixture。

## 影响范围

| 模块 | 影响类型 | 说明 |
|---|---|---|
| `@variojs/types` | 重构 | 收敛 Schema/Action/Material/Diagnostic 契约 |
| `@variojs/core` | 重构 | StateStore、ScopeFrame、ExpressionPlan、ExecutionSession |
| `@variojs/schema` | 重构 | codec、migration、validator、normalizer、compiler |
| `@variojs/vue` | 重构 | 稳定节点组件、节点级更新、loop、boundary、PageSession |
| `@variojs/cli` | 修复/重构 | bin、多页面 codegen、compile/migrate 与 programmatic errors |
| CI/发布 | 新增门禁 | browser/SSR/heap/pack/bundle/performance |

## 依赖与前置条件

- 当前失败用例必须先转为明确的 characterization/regression tests。
- 大规模重构前保留 legacy runtime fallback。
- 浏览器性能必须在固定 runner 重复采样。
- Schema migration 必须保留原文和 previous version，禁止不可逆覆盖。

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|---|:---:|:---:|---|
| prepared runtime 与 legacy DOM/事件语义不一致 | 中 | 高 | shadow prepare、golden fixture、分阶段流量 |
| 安全收紧拒绝历史副作用表达式 | 高 | 中 | legacy diagnostic、迁移建议、只在可信显式模式临时兼容 |
| StateStore 重构引入响应式回归 | 中 | 高 | 双引擎测试、真实 mount/render counter、逐写通道迁移 |
| 画布 migration 破坏历史文档 | 中 | 高 | 纯函数版本迁移、原文保留、双向/回滚 fixture |
| 性能阈值只对实验机有效 | 高 | 中 | 算法门禁 + 固定 runner + RUM 三层并用 |

## 验收标准

- [x] 审计覆盖所有目标包和关键调用链。
- [x] 结论包含简单、中型、大型、深树、loop、画布和多页面。
- [x] P0/P1 均附源码位置或可复现实验。
- [x] 目标架构保护完整根/子出口、类型、返回字段与安全合法行为；`useVario/defineSchema/execute` 主调用方式不变。
- [x] 实施路线按阶段给出模块、测试、回滚和批准范围。
- [x] 文档位于 `docs/architecture-audit/` 并可由 VitePress 构建。
- [x] 当前运行时代码通过生产门禁（2026-09-01 库级验收：core 305 / schema 100 / vue 532 / cli 14 / consumer 10；eslint 0/0；五包 tsc 全过；Chrome baseline JSON 齐全）。

## 调研依据

### 技术可行性

| 调研项 | 结论 | 来源 | 可信度 |
|---|---|---|:---:|
| 保持 useVario 外观演进 | 可行，现有入口可作为 Facade | `packages/vario-vue/src/composable.ts` + 目标接口分析 | 高 |
| Vue 节点级更新 | 可行，应让 node render 直接读取 reactive store | 当前 Vue 调用链 + custom renderer 探针 | 高 |
| Schema prepare | 可行，现有 validator/analyzer/compiler 可分阶段复用 | Core/Schema 源码 | 高 |
| 多页面 Session 隔离 | 可行，但需消除全局 Map/pool | Vue bindings/Core pool 源码 | 高 |

### 性能与安全基准

- 浏览器 mount/update 与 cache/VM/path 探针详见 [调研报告](./research-report.md)。
- 量化目标详见 [验收门禁](./acceptance-gates.md)。

### 已知风险与坑点

- 完整列表见 [生产适用性与风险清单](./production-readiness.md)。

### 信息源分类说明

- **GitHub**：仅审计当前仓库内的 `.github/workflows/`，没有使用远端项目宣传数据。
- **WebSearch**：N/A。用户要求以当前源码逻辑为准，本轮未用网络性能结论替代本地实验。
- **Context7**：N/A。本轮不依赖外部 API 文档得出生产判断。

## 参考资料

### 项目源码

- `packages/*/src`、`scripts/`、`.github/workflows/`
- `packages/*/__tests__`、`tests/integration`
- `output/playwright/vario-audit-benchmark.js`

### GitHub

- 仅引用仓库内 `.github/workflows/`。远端 GitHub 资料：N/A。

### WebSearch

- N/A；按用户要求，本轮核心判断不引用宣传性文档或外性能结论。

## 审计对象

| 范围 | 重点 |
|---|---|
| `@variojs/types` | Schema、Action、Runtime 公共契约与扩展方式 |
| `@variojs/core` | Context、path、expression、cache、Action VM、schema query |
| `@variojs/schema` | validator、normalizer、defineSchema、序列化边界 |
| `@variojs/vue` | useVario、调度、响应式适配、渲染管线、loop、plugin、生命周期 |
| `@variojs/cli` | bin、validate、codegen、dev watch、多页面输出 |
| 工程链路 | package graph、build、lint、unit/integration、发布脚本、CI |

## “可支撑中大型项目”的判定条件

必须同时满足：

1. **正确**：所有合法公开语法在类型、验证、规范化、运行时中语义一致。
2. **可预测**：一次局部状态变化只重算受影响节点，不依赖全树偶然够快。
3. **可隔离**：页面、租户、插件、事件和执行上下文之间没有全局可变状态串扰。
4. **可演进**：Schema 有版本、迁移、物料依赖和兼容策略。
5. **可控**：不可信输入有能力白名单、配额、截止时间、取消和副作用边界。
6. **可观测**：能定位 schema/page/node/action/expression/cache 的失败与长任务。
7. **可发布**：源码、dist、manifest、CLI 和消费侧安装经过同一 CI 事实链。

## 验收标准索引

详细数字见 [验收门禁](./acceptance-gates.md)。本报告结论至少要求：

- [x] P0 正确性与安全探针全部通过（SEC-1～8、STATE-1～4、VM-1～7 测试全绿）。
- [x] 1000 节点更新一个叶子时，不再重建 1000 个节点或 1000 个 loop cell（AC-08/AC-11：regionRender≤4、loopCellRender=1；PERF-T4/T6 p95 0.3–0.4ms）。
- [x] 101 个唯一表达式不再出现相对 100 个约 16.8 倍的 cliff（实测 ratio 0.61×）。
- [x] 1000 行列表实际 DOM 数受虚拟化窗口约束（reference adapter DOM≤204）。
- [x] 20 个 PageSession 可暂停、恢复、销毁，销毁后不保留 RuntimeContext（AC-16/17/18、MEM-3 通过）。
- [x] legacy Schema v0 可无调用方改动地迁移到 `SchemaDocument v1`（COMP-4/legacy adapter + migration golden）。
- [x] 根入口继续兼容，同时提供可 tree-shake 的子路径入口（`@variojs/core/runtime` 子出口 0.6KB gzip，BUNDLE-1～5 通过）。
