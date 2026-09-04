# Phase 4：PageSession、SSR 与内存隔离

> 状态：已完成 | 任务：8 | 净工时：27h  
> 方案：[../plans/05-ssr-memory-rollout.md](../plans/05-ssr-memory-rollout.md)

## 任务

- [x] **T4.1**: 收敛 Engine/Session/cache/registry 资源所有权
  - **描述**：审计并迁移 result memo、ref、component/plugin/action/material registry、subscription 和 pool，模块全局只留 immutable 有界 plan。
  - **产出物**：`packages/vario-core/src/runtime/runtime-session.ts`、`packages/vario-vue/src/runtime/page-session.ts`、`packages/vario-vue/__tests__/runtime/resource-ownership.test.ts`
  - **参考**：`packages/vario-core/src/expression/cache.ts` 的 WeakMap、`packages/vario-vue/src/plugins/index.ts`
  - **复用**：immutable Prepared/Expression plan cache、T2.1 PageSession cleanup registry。
  - **验收**：result/ref/registry/plugin/subscription 均有 Engine/Session owner；只有 frozen plan 可共享；跨 Session state/result 不可见。
  - **预估**：4h
  - **依赖**：T2.8、T3.9

- [x] **T4.2**: 实现 active/inactive/paused/disposed 生命周期
  - **描述**：实现 pause/resume/dispose、ChangeSet 合并、Abort/clear/unsubscribe/ref cleanup 与 disposed guard。
  - **产出物**：`packages/vario-vue/src/runtime/session-lifecycle.ts`、`packages/vario-vue/__tests__/runtime/session-lifecycle.test.ts`
  - **参考**：`use-vario-phases.ts` 的 unsubscribe/onUnmounted、现有 `RefsRegistry`。
  - **复用**：effectScope、AbortSignal、clearCache、T4.1 ownership table。
  - **验收**：paused 页 render/action=0；resume 只提交一次合并变更；dispose 幂等且资源=0；终态调用返回 `SESSION_DISPOSED`。
  - **预估**：4h
  - **依赖**：T4.1

- [x] **T4.3**: 实现 Vue 3.4 fallback 与 3.5 scope capability detection
  - **描述**：封装 effect scope stop/pause/resume 能力，3.4 用门控/stop-recreate，3.5 使用可用原生方法。
  - **产出物**：`packages/vario-vue/src/runtime/vue-capabilities.ts`、`packages/vario-vue/__tests__/runtime/vue-capabilities.test.ts`
  - **参考**：`packages/vario-vue/package.json` 的 Vue 兼容范围、本地 Vue 3.5 effectScope API。
  - **复用**：T4.2 Session state machine 和 feature detection 风格。
  - **验收**：Vue 3.4/3.5 两路均通过；pause/resume 不重复注册 effect/subscription；公开调用与返回完全一致。
  - **预估**：3h
  - **依赖**：T4.2

- [x] **T4.4**: 创建每请求独立 SSR Engine/PageSession factory
  - **描述**：允许共享 immutable PreparedView/Plan，但为每个请求建立独立 state、memo、registry overlay、scope 与 execution。
  - **产出物**：`packages/vario-vue/src/ssr/create-ssr-session.ts`、`packages/vario-vue/src/ssr/index.ts`、`packages/vario-vue/__tests__/ssr/session-factory.test.ts`
  - **参考**：`packages/vario-vue/src/composable.ts` 初始化管线。
  - **复用**：T4.1 RuntimeSession、PreparedView cache 和 existing useVario Facade internals。
  - **验收**：每请求 state/registry/result memo 独立；server render 不修改 Schema/持久 state；请求结束自动 dispose。
  - **预估**：3h
  - **依赖**：T4.1

- [x] **T4.5**: 建立 renderToString 到 hydrate feature fixture
  - **描述**：覆盖 cond/show/loop/model/error/slot/Teleport，比较 SSR→hydrate 与客户端直接 mount。
  - **产出物**：`packages/vario-vue/__tests__/ssr/hydration.test.ts`、`tests/fixtures/ssr-vario-app/package.json`、`tests/fixtures/ssr-vario-app/src/App.vue`
  - **参考**：`tests/integration/error-boundary.test.ts`、现有 Vue feature tests。
  - **复用**：VarioRoot、LoopRegion、ErrorBoundary、Vite SSR fixture。
  - **验收**：所有 fixture 0 hydration mismatch；DOM/state/diagnostic 等价客户端直挂；model default 在 render 前 transaction 完成。
  - **预估**：4h
  - **依赖**：T4.3、T4.4

- [x] **T4.6**: 建立 50 并发 SSR 请求隔离测试
  - **描述**：并发注入不同 state/material/action/plugin/diagnostic sink，检测输出和资源串扰。
  - **产出物**：`packages/vario-vue/__tests__/ssr/request-isolation.test.ts`、`packages/vario-vue/__tests__/ssr/fixtures.ts`
  - **参考**：T4.4 request factory、总门禁 SSR-1～SSR-5。
  - **复用**：Promise concurrency fixture、Session resource counters。
  - **验收**：50 请求输出完全对应自己的输入；registry/cache result 不串；结束后 subscription/execution/session resource=0。
  - **预估**：3h
  - **依赖**：T4.4

- [x] **T4.7**: 创建 CDP GC、heap snapshot 与 retainer runner
  - **描述**：自动执行 loop/session/SSR 生命周期并采集 retained bytes、object count、slope 和 retainer path。
  - **产出物**：`benchmarks/vue-depth/heap-runner.ts`、`benchmarks/vue-depth/heap-budget.json`、`benchmarks/vue-depth/heap-result.schema.json`
  - **参考**：`output/playwright/vario-audit-benchmark.js`、Chrome DevTools Protocol HeapProfiler。
  - **复用**：T0.3 runner environment metadata、CDP collectGarbage 和 T4.2 counters。
  - **验收**：结果含 GC 前后、retained bytes/retainer/slope；可复现；不得用单点 `performance.memory` 代替。
  - **预估**：4h
  - **依赖**：T0.3、T4.2

- [x] **T4.8**: 执行 loop、100 Session 与 SSR 销毁门禁
  - **描述**：运行 20 轮 loop mount/unmount、100 次 page create/dispose 和 SSR isolation/hydration，保存统一证据。
  - **产出物**：`benchmarks/vue-depth/baseline/ssr-memory.json`、`packages/vario-vue/__tests__/browser/session-memory.test.ts`
  - **参考**：总门禁 MEM-1～5、LIFE-1～5、SSR-1～5 与专项 AC-17～AC-19。
  - **复用**：T4.5/T4.6 fixtures、T4.7 heap runner。
  - **验收**：loop 无持续斜率；100 Session retained≤5MB 且趋稳；50 SSR isolation/hydration 全绿；dispose 后资源全为 0。
  - **预估**：2h
  - **依赖**：T4.5、T4.6、T4.7

## 阶段出口

- [x] Vue 3.4/3.5 生命周期路径均正确。
- [x] CSR 多页、SSR/hydration/request isolation 与 heap 门禁通过。
- [x] 默认仍为 canary 候选，尚未全量切流。

