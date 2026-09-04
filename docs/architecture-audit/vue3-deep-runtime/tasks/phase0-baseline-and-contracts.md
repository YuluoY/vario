# Phase 0：真实基线、深度与正确性契约

> 状态：已完成 | 任务：8 | 净工时：22h  
> 方案：[../plans/01-baseline-correctness.md](../plans/01-baseline-correctness.md)

## 任务

- [x] **T0.1**: 创建深度、宽度、state、loop 与多页面确定性场景生成器
  - **描述**：定义 `N/D/S/R/M` 场景类型与 seed 生成逻辑，输出 Schema、state、mutation 和 expected result。
  - **产出物**：`benchmarks/vue-depth/fixtures.ts`、`benchmarks/vue-depth/types.ts`
  - **参考**：`packages/vario-vue/__tests__/features/stress-test.test.ts`、`packages/vario-vue/__tests__/comprehensive-perf-report.test.ts`
  - **复用**：现有 `SchemaNode` 构造方式和 Vitest fixture 约定。
  - **验收**：可生成 flat/deep/dynamic/loop/nested-loop/multipage；相同 seed 的 Schema、state 与 expected result 深等价。
  - **预估**：2h
  - **依赖**：无

- [x] **T0.2**: 增加内部 operation/render/DOM 计数 Hook
  - **描述**：提供默认 no-op、仅测试或诊断启用的计数接口，覆盖 prepare、index、legacy render、region、loop cell、expression 与 DOM commit。
  - **产出物**：`packages/vario-vue/src/internal/performance-hooks.ts`、`packages/vario-vue/__tests__/performance-hooks.test.ts`
  - **参考**：`packages/vario-vue/src/renderer.ts` 的 `registerParentMap`、`packages/vario-core/src/expression/evaluate.ts`
  - **复用**：现有 plugin hook/no-op callback 设计；计数器不进入必需 public API。
  - **验收**：关闭时行为、public export 和渲染结果不变；开启时每个计数可确定性断言；hook throw 不影响业务。
  - **预估**：2h
  - **依赖**：T0.1

- [x] **T0.3**: 固化 production 浏览器 benchmark runner 与 JSON Schema
  - **描述**：把一次性 Playwright 审计脚本迁移为可重复 runner，区分 prepare、Vue commit、paint、正确性和 long task。
  - **产出物**：`benchmarks/vue-depth/browser-runner.ts`、`benchmarks/vue-depth/vite.config.ts`、`benchmarks/vue-depth/result.schema.json`
  - **参考**：`output/playwright/vario-audit-benchmark.js`、`play/vite.config.ts`
  - **复用**：现有 Vite playground、真实 Vue mount 和 Playwright/Chrome CDP。
  - **验收**：记录 runner/commit/worktree/Node/Chrome/Vue/mode；20 次预热、50 次采样、3 独立进程；JSON 含 correctness/render/DOM/p95/long-task 与原始样本。
  - **预估**：4h
  - **依赖**：T0.1

- [x] **T0.4**: 补齐深度 mount/update 与异常传播测试
  - **描述**：覆盖 `D∈{1,20,50,100,101,200,500,1000}`，验证最深 DOM、更新、unmount、cycle、RangeError 和超限 diagnostic。
  - **产出物**：`packages/vario-vue/__tests__/correctness/depth-render.test.ts`、`packages/vario-vue/__tests__/correctness/error-propagation.test.ts`
  - **参考**：`packages/vario-vue/src/features/children-resolver.ts`、`packages/vario-schema/src/validator.ts`
  - **复用**：`VueRenderer.render`、现有 error fallback 与 custom renderer 测试工具。
  - **验收**：`D≤100` DOM 完整；`D>100` mount 前 typed diagnostic；任何 RangeError 不得被转换成 null child 或部分成功 DOM。
  - **预估**：3h
  - **依赖**：T0.1

- [x] **T0.5**: 固化连续写、单叶更新、lifecycle 与 state 规模矩阵
  - **描述**：把当前 `S=100..20,000` 趋势、同 tick 多写和 lifecycle 重挂变成正确性与性能 baseline。
  - **产出物**：`packages/vario-vue/__tests__/correctness/update-routing.test.ts`、`packages/vario-vue/__tests__/correctness/lifecycle-identity.test.ts`
  - **参考**：`packages/vario-vue/src/composables/internal/use-vario-phases.ts`、`packages/vario-vue/src/features/lifecycle-wrapper.ts`
  - **复用**：T0.1 fixture、T0.2 counters 和现有 adapter performance harness。
  - **验收**：连续写 DOM 等于最终值；baseline 明确 mounted/unmounted/updated；state 规模矩阵保存原始数据且失败不计为性能通过。
  - **预估**：3h
  - **依赖**：T0.1、T0.2

- [x] **T0.6**: 补齐 loop alias、nested loop、scoped slot 与 deep model 回归
  - **描述**：建立 itemKey/indexKey、`$item/$index`、自定义 alias、slot props、node context 和 model 写回的完整 fixture。
  - **产出物**：`packages/vario-vue/__tests__/correctness/loop-slot-scope.test.ts`、`packages/vario-vue/__tests__/correctness/deep-model.test.ts`
  - **参考**：`packages/vario-vue/src/features/loop-handler.ts`、`packages/vario-vue/src/features/loop-item-cell.ts`、`packages/vario-vue/src/features/path-resolver.ts`
  - **复用**：现有 `todo-loop.test.ts`、model-path 与 node-context 测试语法。
  - **验收**：item/index/nested alias/slot/model 均断言真实文本、事件上下文和写回路径；当前失败作为明确 red baseline 保留。
  - **预估**：4h
  - **依赖**：T0.1

- [x] **T0.7**: 统一 prepare/mount 深度诊断并禁止吞递归异常
  - **描述**：分离 compiler safety depth 与 Vue mount depth；让 children/slot 递归错误进入 typed diagnostic/ErrorBoundary。
  - **产出物**：`packages/vario-schema/src/validator.ts`、`packages/vario-vue/src/features/children-resolver.ts`、`packages/vario-core/src/errors.ts`
  - **参考**：当前 `DEFAULT_MAX_DEPTH=100`、children resolver 的 catch-null 路径、现有 `VarioError` 层级。
  - **复用**：`SchemaValidationError`、现有 `error/onError` 返回通道。
  - **验收**：compiler 可用显式扫描验证 10,000 层而无 RangeError；mount 默认 101 在 VNode 前阻断；diagnostic 含 phase/node path/actual/limit。
  - **预估**：2h
  - **依赖**：T0.4

- [x] **T0.8**: 采集可重放 legacy 与完整 public API baseline
  - **描述**：运行 Phase 0 fixture，保存环境/原始结果，并对根/子出口、value/type、overload 和 `UseVarioResult` 生成兼容 snapshot。
  - **产出物**：`benchmarks/vue-depth/baseline/legacy.json`、`benchmarks/vue-depth/baseline/environment.json`、`packages/vario-vue/__tests__/public-api-compat.test.ts`
  - **参考**：各包 `src/index.ts`、`package.json#exports`、`packages/vario-vue/src/types.ts`
  - **复用**：T0.2 计数、T0.3 runner、Vitest snapshot 和现有 consumer build。
  - **验收**：baseline 能在相同 commit/profile 重放；public values/types/overloads/return fields 零漏项；所有红项有错误码而非静默输出。
  - **预估**：2h
  - **依赖**：T0.2、T0.3、T0.4、T0.5、T0.6、T0.7

## 阶段出口

- [x] T0.1～T0.8 全部完成并链接到原始证据。
- [x] 深度、loop、lifecycle、连续写和 public API baseline 可重放。
- [x] 未删除 state deep watch，默认 runtime 仍为 legacy。
