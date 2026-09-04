# Phase 5：Shadow、Canary 与生产发布门禁

> 状态：已完成 | 任务：8 | 净工时：25h  
> 方案：[../plans/05-ssr-memory-rollout.md](../plans/05-ssr-memory-rollout.md)

## 任务

- [x] **T5.1**: 固化 legacy/shadow/prepared 与零改动回退开关
  - **描述**：允许按构建、Engine、租户或 Session 配置 mode，保留同一 `useVario` Facade 和 Schema/state。
  - **产出物**：`packages/vario-vue/src/runtime/runtime-mode.ts`、`packages/vario-vue/__tests__/runtime/runtime-mode.test.ts`
  - **参考**：T1.8 runtime mode、`packages/vario-vue/src/composable.ts`
  - **复用**：原 `useVario` Facade、Prepared/legacy adapters。
  - **验收**：调用方无需改动即可切换；退 legacy 不重载/迁移 Schema；Session 级隔离；无永久绕过安全策略的开关。
  - **预估**：2h
  - **依赖**：T2.8

- [x] **T5.2**: 实现无双副作用的 dual-runtime comparator
  - **描述**：canonical 比较 DOM/text/attrs、emit、ChangeSet、ref、error、diagnostic/lifecycle，prepared shadow 不重复业务执行。
  - **产出物**：`packages/vario-vue/src/runtime/shadow-comparator.ts`、`packages/vario-vue/__tests__/runtime/shadow-comparator.test.ts`
  - **参考**：legacy `VueRenderer`、PreparedRenderer 和 Phase 0 contract fixture。
  - **复用**：normalization canonicalizer、stable node/path IDs 和 recorded effect events。
  - **验收**：差异含 nodeId/path/field；不比较 VNode identity；action/service/lifecycle 只执行一次；已知顺序无关字段规范化。
  - **预估**：4h
  - **依赖**：T3.9、T5.1

- [x] **T5.3**: 实现隐私安全的 DiagnosticSink 与 runtime metrics
  - **描述**：记录 prepare/render/cache/session/action/canary 的稳定 ID、计数、耗时、采样与背压。
  - **产出物**：`packages/vario-core/src/diagnostics/diagnostic-sink.ts`、`packages/vario-vue/src/runtime/runtime-metrics.ts`、`packages/vario-vue/__tests__/runtime/runtime-metrics.test.ts`
  - **参考**：现有 `getCacheStats`、schema analyzer stats、总门禁 OBS-1～5。
  - **复用**：no-op sink、T0 counters 和 Session IDs。
  - **验收**：page/node/plan/execution ID 稳定；sink throw 不影响业务；支持采样/背压；不输出 state/token/表达式原文/完整 event payload。
  - **预估**：4h
  - **依赖**：T4.1、T5.1

- [x] **T5.4**: 固化 fixed-runner profile 与锁定预算脚本
  - **描述**：把 provisional budget 经两次独立基线校准转成 versioned profile，自动验证正确性、算法、p95、long task 与 heap。
  - **产出物**：`benchmarks/vue-depth/run-profile.ts`、`benchmarks/vue-depth/performance-budgets.json`、`benchmarks/vue-depth/profile.schema.json`
  - **参考**：`docs/architecture-audit/acceptance-gates.md` 固定 runner 协议。
  - **复用**：T0 browser runner、T4 heap runner、T5.3 metrics。
  - **验收**：两次校准；20 warmup/50 samples/3 processes；三轮 p95 中位数；raw JSON 留存；算法退化不得靠放宽阈值通过。
  - **预估**：3h
  - **依赖**：T0.3、T4.7、T5.3

- [x] **T5.5**: 实现 canary 阈值与自动回退控制器
  - **描述**：按 Session/租户监测 parity/error/perf/heap，命中阈值只回退对应单元并记录原因。
  - **产出物**：`packages/vario-vue/src/runtime/canary-controller.ts`、`packages/vario-vue/__tests__/runtime/canary-controller.test.ts`
  - **参考**：T5.1 mode、T5.2 comparator、总 roadmap 灰度与回滚方案。
  - **复用**：T5.3 DiagnosticSink 和 T5.4 budget profile。
  - **验收**：correctness/parity 任一差异立即回退；perf/heap 阈值停止扩量；记录 mode/version/time/reason；API/Schema/state 不变。
  - **预估**：3h
  - **依赖**：T5.2、T5.3、T5.4

- [x] **T5.6**: 补齐 Vue/CSR/SSR/规模 consumer matrix 与 CI
  - **描述**：用打包产物覆盖 Vue 3.4/3.5 × CSR/SSR × 200/1000 nodes，并执行类型、ESM、peer、hydrate 与 mode 回退。
  - **产出物**：`tests/consumer/vue-depth-performance/package.json`、`tests/consumer/vue-depth-performance/src/App.vue`、`.github/workflows/ci.yml`
  - **参考**：`tests/integration/vue-element-plus.test.ts`、现有 consumer/release gates。
  - **复用**：pnpm pack、Vite/Vue SSR fixture、T4.5 hydration 和 T5.5 canary。
  - **验收**：Vue 3.4/3.5×CSR/SSR×200/1000 全绿；ESM/types/peer 正确；legacy/prepared/rollback 都无需改调用代码。
  - **预估**：4h
  - **依赖**：T4.8、T5.5

- [x] **T5.7**: 执行 1%→10%→50% 发布与强制回滚演练
  - **描述**：在可控 fixture/内部环境演练扩量、阈值触发、单 Session 回退与证据留存。
  - **产出物**：`benchmarks/vue-depth/reports/release-candidate.json`、`benchmarks/vue-depth/reports/rollback-rehearsal.md`
  - **参考**：`docs/architecture-audit/implementation-roadmap.md` 的灰度与回滚方案。
  - **复用**：T5.5 canary controller、T5.6 consumer matrix、locked budget。
  - **验收**：1%/10%/50% 各有时间戳/profile/结果；注入 correctness/perf/heap 故障均按预期回退；业务 Schema/API 不变。
  - **预估**：2h
  - **依赖**：T5.6

- [x] **T5.8**: 生成逐门禁验收、变更日志与复盘
  - **描述**：按规格 AC 与总 VUE/PERF/MEM/SSR/COMP gate 逐项引用原始证据；只有真实完成后更新状态和发布记录。
  - **产出物**：`docs/architecture-audit/vue3-deep-runtime/verification-report.md`、`docs/architecture-audit/vue3-deep-runtime/retrospective.md`、`./CHANGELOG.md`
  - **参考**：`uluo-doc-standards` 的 verification/retrospective/CHANGELOG 模板、专项 `spec.md`。
  - **复用**：T5.7 rehearsal、所有 baseline JSON、现有总审计 gate IDs。
  - **验收**：AC/gate 1:1 且有 commit/命令/原始证据；文档校验、lint/tsc/unit/browser/SSR/consumer 全通过；未通过项不勾选、不写生产完成。
  - **预估**：3h
  - **依赖**：T5.7

## 阶段出口

- [x] T5.1～T5.8 完成，51 项任务均有可审计证据。
- [x] 生产准入仅授予实际通过的场景档位，不因文档完成自动授权。
- [x] legacy 移除仍需单独 major-version 评审。

