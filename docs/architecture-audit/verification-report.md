# 审计验收报告

> 日期：2026-08-31（2026-09-01 更新实施验收状态）  
> 状态：审计文档 5/5 完成；实施验收：库级 G6 Production Core 已授予（详见 [专项验收报告](./vue3-deep-runtime/verification-report.md)）  
> 基线：`main@0d513afa8c338729aba1e9fd3351e1b47c7cb582` + 审计开始前已有工作树改动

## 验收概要

本轮审计文档需求 5/5 完成，交付通过率 **100%**。审计时点当前运行时生产准入为 **0%**（P0 安全与正确性门禁尚未实施），因此本报告对”审计交付”验收通过；该判定已于 2026-09-01 随 [实施路线图 Phase 0～5](./implementation-roadmap.md) 落地而解除——库级全量测试（core 305 / schema 100 / vue 532 / cli 14 / consumer 10）、eslint 0/0、五包 tsc 全过，库级 G6 Production Core 授予。

| 目标 | 结果 | 证据 |
|---|:---:|---|
| 不采用文档中的性能宣称 | 通过 | 结论来自源码、测试方法审查、Node/Chrome 探针 |
| 判断真实 Vue 中大型适用性 | 通过 | [生产适用性](./production-readiness.md) |
| 覆盖简单、复杂、嵌套、loop、多页面、画布 | 通过 | [性能基准](./performance-benchmarks.md) |
| 识别性能与局限性 | 通过 | P0～P2 风险清单与复杂度表 |
| 保持现有使用方式 | 设计已覆盖，实现待验 | [完整 public API 兼容矩阵](./target-architecture.md#公共兼容矩阵)；Phase 0 先生成 API/行为基线 |
| 输出 docs 模块化可实施文档 | 通过 | 本目录 11 份互链文档 |
| 给出可落地路线与验收标准 | 通过 | [实施路线](./implementation-roadmap.md) · [验收门禁](./acceptance-gates.md) |

## 验收标准逐条对照

- [x] **[FR-1]** 源码架构审计
  - **验证方式**：按 `types → core → schema → vue/cli` 追踪依赖、公共入口和运行时调用链，并对包 manifest/build/CI 交叉校验。
  - **证据**：[当前架构](./current-architecture.md) 中的包图、调用链、热点模块和依赖方向。

- [x] **[FR-2]** 分级性能与正确性验证
  - **验证方式**：运行现有单元/集成测试，以 Chrome 真实 mount/patch 执行 100～2000 节点、loop、深树、画布 mutation 和 5～20 页。
  - **证据**：[性能基准](./performance-benchmarks.md) 与 `output/playwright/vario-audit-benchmark.js`。

- [x] **[FR-3]** 低代码生产边界判断
  - **验证方式**：执行 path 原型污染、VM 嵌套配额、timeout 后副作用、Schema 契约与 CLI bin 定向探针。
  - **证据**：[生产适用性](./production-readiness.md) 的 P0/P1 清单及本文“定向正确性/安全探针”。

- [x] **[FR-4]** 兼容目标架构
  - **验证方式**：对所有根/子出口、类型、构造器、overload、返回字段和关键行为制定基线策略；`useVario/defineSchema/execute` 主入口逐项制定兼容矩阵，内部拆分为 PreparedView、RuntimeSession、StateStore、ExecutionSession 和稳定 Vue 节点图。
  - **证据**：[目标架构](./target-architecture.md) 的公共兼容矩阵、数据流和回滚设计。

- [x] **[FR-5]** 实施与验收
  - **验证方式**：将 P0～P2 拆成 Phase 0～4，每阶段标注模块、依赖、测试、准入、灰度和回滚。
  - **证据**：[执行计划](./plans/README.md)、[实施路线](./implementation-roadmap.md) 与 [验收门禁](./acceptance-gates.md)。

## 产出物

```text
docs/architecture-audit/
├── index.md
├── spec.md
├── research-report.md
├── current-architecture.md
├── production-readiness.md
├── performance-benchmarks.md
├── target-architecture.md
├── plans/README.md
├── implementation-roadmap.md
├── acceptance-gates.md
└── verification-report.md
```

另有可复现的浏览器实验脚本：

```text
output/playwright/vario-audit-benchmark.js
```

文档入口已加入：

- `docs/.vitepress/config.ts`
- `docs/index.md`

## 测试结果汇总

自动化用例数字为 Core 217/218、Vue 329/337、Schema 35/35、CLI 6/6、Integration 42/42。本轮未使用 coverage provider 重跑全仓，因此语句/分支**覆盖率**为 N/A；此处不用“用例数”伪装覆盖率。

### 当前源码状态

| 命令 | 结果 | 结论 |
|---|---|---|
| `pnpm test` | 失败 | Core 217/218；loop alias 回归 |
| `pnpm --filter @variojs/vue test` | 失败 | 329/337；8 个 todo-loop 失败 |
| `pnpm test:integration` | 通过 42/42 | 有 Vue render-context warning；配置未证明正式包出口 |
| `pnpm --filter @variojs/cli test` | 通过 6/6 | 未覆盖实际 bin，bin 探针仍失败 |
| `pnpm lint` | 失败 | 2 errors、5 warnings |
| `pnpm build` | 通过 | 约 6.44s；只证明可产出 JS/DTS |
| `pnpm --filter ./play build` | 通过 | 约 25.56s；bundle 很大且含 playground 重依赖 |

因此“构建通过”不能覆盖正确性、安全和发布链失败，当前生产验收结论是**未通过**。

### 定向正确性/安全探针

| 探针 | 当前结果 | 应有结果 |
|---|---|---|
| `__proto__` path write | 可污染 Object.prototype | 快速拒绝且无副作用 |
| `_set` 21 段 path | 静默失败但发 callback | typed error，不发成功通知 |
| nested VM `maxSteps=1` | 20 次 body 全执行 | 第二步前中止 |
| async handler timeout | reject 后仍写 state | cancel 后禁止 commit |
| EventHandler contract | 合法形式被拒，unknown action 通过 | 与 Types/Runtime 一致 |
| normalizer extension | id/Vue/extension/model options 丢失 | 结构保留 |
| CLI bin `--help` | 无输出、exit 0 | 显示 help |

### 真实浏览器探针

| 探针 | 当前结果 |
|---|---|
| 100/500/1000 动态节点单字段更新 | 0.9/3.2/8.8ms 中位数，随整页线性增长 |
| 100/500/1000 loop 单项更新 | 1.5/5.9/10.6ms，且文本正确性失败 |
| 20 页 × 200 节点 | mount 20.8ms；更新一个页 1.4ms |
| 深层 Schema 原位修改 | 不刷新 |
| 替换根 Schema | 刷新 |
| lifecycle 状态更新一次 | mounted=2、unmounted=1 |

## 文档质量检查

- [x] 每份文档只回答一个主要问题。
- [x] 关键决策同时说明选择、原因、替代方案和影响。
- [x] 内部文档使用相对链接。
- [x] 流程图使用 Mermaid，目录树使用 plain text。
- [x] 所有核心结论有源码行、命令或实验支撑。
- [x] 明确区分微基准、真实 mount 和生产 RUM。
- [x] 不适用的外部资料未编造，按用户要求只使用本地源码证据。
- [x] 大规模代码实施未伪装成已完成；路线图与当前状态分开。
- [x] 独立交叉审阅后，已将兼容范围从三个主入口扩展到完整 public API surface，并修正分阶段发布/全量门禁矛盾。

## Soft Rules Self-Check

### 场景：HEAVY 架构审计 | 语言：TypeScript / Vue

#### § 通用规则

- [x] G1.1～G1.4 函数设计 — 已识别 evaluator/renderer/validator 上帝模块、嵌套执行与批量语义问题。
- [x] G2.1～G2.3 错误处理 — 已记录吞错、错误边界失效、BatchError 二次包装和发布错误语义。
- [x] G3.1～G3.3 依赖管理 — 已还原真实 DAG，标出全局 registry/pool 和 manifest 假循环。
- [x] G4.1～G4.3 值归属 — cache 阈值、path 限制、plugin/material/version 归属已进入目标模块。
- [x] G5.1～G5.4 命名 — 保留现有公共名；新设计使用 PreparedView/RuntimeSession/StateStore/ScopeFrame 明确职责。
- [x] G6.1～G6.3 文件纯度 — 已列出 711/556/482 行热点并给出按 policy/plan/session 拆分。
- [x] G7.1～G7.7 设计质量 — 比较三种方案，选择兼容 Facade + compiler/session，避免无安全网整体重写。
- [x] G8.1～G8.2 注释/Public API — 已指出“atomic/LRU/pool/errorBoundary”等注释与实现不一致。

#### § Vue 规则

- [x] V1/V2 数据契约 — 目标架构保留 typed public contract，状态写统一 StateStore。
- [x] V3 列表 key — 已区分 loop alias 与稳定 key，禁止默认 index 无告警。
- [x] V4/V5 computed/watch — 已识别 deep sync watch 与双调度，目标使用节点级 Vue 依赖跟踪。
- [x] V6 逻辑提取 — 目标拆为 VarioRoot/Node/LoopRegion/Boundary 与 Session composables。
- [x] V7/V8 样式/SFC — 本轮未新增 SFC；N/A。

#### § 架构与测试

- [x] A1～A6 分层/出口 — 现有包边界保留，删除虚假 core→schema，新增 subpath export。
- [x] A7/I4～I7 基础设施 — diagnostics、错误、性能预算、发布门禁已设计；当前实现缺口标为 P1。
- [x] T1～T4 测试 — unit 数量充足但断言层级不足；已给 browser/contract/security/heap/consumer 测试矩阵。

### 工具验证

| 项目 | 状态 |
|---|---|
| VitePress build/link | 通过；`pnpm build:docs` 完成 client/server render；11/11 文档路径通过；额外对构建 HTML 检查 8/8 个 fragment ID 通过 |
| 文档规范 | 通过；`validate-docs --strict` 为 66 pass、0 fail、19 warning；警告来自可选 retrospective/CHANGELOG、版本号/性能序列被误识别为日期，以及校验器的 L3 行正则在信息源列前截断（原表每项已列 3 个本地证据源） |
| ESLint | `docs/.vitepress/config.ts` 单文件通过；全仓当前仍为 2 errors、5 warnings，详见“当前源码状态” |
| TypeScript/build | 包构建与 playground build 通过 |
| uluo-web-standards validator | ESLint 阶段通过；其 `tsc` 驱动固定查找仓库根 `tsconfig.json`，本项目只有 `tsconfig.base.json`/包级 config，因此以 TS5057 结束；实际包 build 已单独通过 |

### 结果

审计文档满足规则；被审计生产代码不满足生产门禁，偏离项已全部进入风险清单和阶段任务，未标记为通过。

## 已知问题/偏离项

| 问题 | 影响 | 当前状态 | 处理计划 |
|---|---|---|---|
| loop alias 单测回归 | Core/Vue 正确性 | 未通过 | Phase 0 统一 ScopeFrame，先补回归再修复 |
| 完整 public API/行为基线尚未生成 | 内核重构可能无意 breaking | 设计已覆盖，实现未通过 | Phase 0 改实现前先生成 export/d.ts/contract/tarball baseline |
| 原型污染与表达式副作用 | 不可信 Schema 可越界 | 未通过 | Phase 0 SafePathPlan + exact capability allowlist |
| Vue 全树更新与 wrapper remount | 中大页面更新和生命周期 | 未通过 | Phase 2 稳定 VarioNode 图与节点级响应式 |
| 全局 registry/cache/pool | 多页面、SSR 和内存隔离 | 未通过 | Phase 1/3 迁入 Engine/PageSession 并强制 dispose |
| CLI/发布事实链不完整 | 消费者可能拿到旧 dist/无效 bin | 未通过 | Phase 0 增加 clean build、pack consumer 和 bin smoke |
| Core/bundle/render-counter 只保存汇总数字 | 当前审计可追溯，但尚非完整 CI benchmark | 部分通过 | Phase 0 固化全部 harness、原始 JSON、runner ID 与 production-mode 协议 |

## 未修改与已保护内容

- 未回退或覆盖审计开始前的任何未提交源码改动。
- 未修改 `packages/*/src` 生产实现。
- `pnpm build` 只重建 gitignored dist。
- 本轮新增内容集中在审计文档、VitePress 导航和本地浏览器 benchmark harness。

## 结论

⚠️ **有条件通过**：审计文档交付通过；当前库生产就绪不通过，不应直接用作可执行不可信 Schema 的中大型低代码核心。  
下一步唯一正确入口：[Phase 0 生产阻断修复](./implementation-roadmap.md#phase-0-生产阻断修复)。
