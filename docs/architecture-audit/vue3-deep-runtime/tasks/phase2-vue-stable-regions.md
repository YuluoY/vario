# Phase 2：Vue 3 稳定根、StateBridge 与区域组件

> 状态：已完成 | 任务：9 | 净工时：34h  
> 方案：[../plans/03-vue-stable-regions.md](../plans/03-vue-stable-regions.md)

## 任务

- [x] **T2.1**: 创建 PageSession 与 effectScope 生命周期
  - **描述**：每次 `useVario` 创建一个 Session，持有 PreparedView、StateStore、effect scope、cleanup、refs、memo 与 execution registry。
  - **产出物**：`packages/vario-vue/src/runtime/page-session.ts`、`packages/vario-vue/__tests__/runtime/page-session.test.ts`
  - **参考**：`packages/vario-vue/src/composables/internal/use-vario-phases.ts` 的 setup/unsubscribe/unmount。
  - **复用**：Vue `effectScope/onScopeDispose/onUnmounted`、现有 cleanup callback 和 RuntimeContext。
  - **验收**：每个 `useVario` 恰好一个 Session；dispose 幂等；effect/timer/subscription/execution/ref 计数均归 Session。
  - **预估**：4h
  - **依赖**：T1.8

- [x] **T2.2**: 实现 ChangeSet 到 region token 的 VueStateBridge
  - **描述**：订阅 StateStore transaction，按 PreparedView dependency index 路由、去重并递增浅层 region token。
  - **产出物**：`packages/vario-vue/src/runtime/state-bridge.ts`、`packages/vario-vue/__tests__/runtime/state-bridge.test.ts`
  - **参考**：`packages/vario-vue/src/adapter.ts`、`packages/vario-vue/src/composables/internal/invalidation-controller.ts`
  - **复用**：StateStore ChangeSet/path matcher、Vue `shallowRef` 和 T0 counters。
  - **验收**：一次 batch 只通知一次；改变 x 不遍历整个 state、不触发 y token；dynamic dependency 显式进入 conservative region。
  - **预估**：4h
  - **依赖**：T1.6、T2.1

- [x] **T2.3**: 实现模块级稳定 VarioRoot
  - **描述**：创建一次定义的根组件，props 只传 session/root IDs，普通 state mutation 不替换 root instance。
  - **产出物**：`packages/vario-vue/src/components/vario-root.ts`、`packages/vario-vue/__tests__/components/vario-root.test.ts`
  - **参考**：`packages/vario-vue/src/renderer.ts#render`、当前 `vnodeRef` 调度。
  - **复用**：Vue `defineComponent`、typed provide/inject、`markRaw` Session service。
  - **验收**：普通 state 更新前后 VarioRoot type/instance/session identity 稳定；Schema revision 独立替换 PreparedView。
  - **预估**：3h
  - **依赖**：T2.1

- [x] **T2.4**: 实现 DynamicRegion 精确订阅
  - **描述**：按 sessionId/regionId 解析 PreparedNode 与 token，在 render effect 中只读取该区域真实依赖。
  - **产出物**：`packages/vario-vue/src/components/dynamic-region.ts`、`packages/vario-vue/__tests__/components/dynamic-region.test.ts`
  - **参考**：`packages/vario-vue/src/features/vario-node.ts`
  - **复用**：T1.4 region classification、T2.2 token、existing component resolver。
  - **验收**：props 仅稳定 ID/key；单叶只让目标 region 与必要祖先 render；未命中 region render=0；业务 state 未被 markRaw。
  - **预估**：4h
  - **依赖**：T1.4、T2.2、T2.3

- [x] **T2.5**: 实现最大静态骨架 StaticRegion
  - **描述**：按 plan 构建无 reactive read 的静态 VNode 骨架，每个 mount 实例一次创建并按 revision 失效。
  - **产出物**：`packages/vario-vue/src/components/static-region.ts`、`packages/vario-vue/__tests__/components/static-region.test.ts`
  - **参考**：`packages/vario-vue/src/renderer.ts#createVNode`、Vue VNode ownership 约束。
  - **复用**：PreparedNode static flags、component resolver 和静态 attrs cache 语义。
  - **验收**：state update 时 static interpreter=0；不跨 Session/mount 复用已挂载 VNode；副作用 feature 不误归静态。
  - **预估**：4h
  - **依赖**：T1.4、T2.3

- [x] **T2.6**: 实现固定 LifecycleBoundary 与 ErrorBoundary
  - **描述**：把 render-time component definition 替换为 module-level type，并覆盖 descendant setup/render/update 错误。
  - **产出物**：`packages/vario-vue/src/components/lifecycle-boundary.ts`、`packages/vario-vue/src/components/error-boundary.ts`、`packages/vario-vue/__tests__/components/boundaries.test.ts`
  - **参考**：`packages/vario-vue/src/features/lifecycle-wrapper.ts`、`packages/vario-vue/src/composables/internal/error-fallback.ts`
  - **复用**：Vue lifecycle API、`onErrorCaptured`、现有 fallback/onError。
  - **验收**：普通 update 后 mounted=1/unmounted=0/updated=1；descendant setup/render/update 全进入 fallback+node/phase diagnostic。
  - **预估**：4h
  - **依赖**：T2.3

- [x] **T2.7**: 实现 PreparedRenderer 与统一 VNode feature pipeline
  - **描述**：合并 legacy renderer/VarioNode 的 attrs、model、event、directive、ref、slot、plugin 与 semantic boundary 后处理。
  - **产出物**：`packages/vario-vue/src/runtime/prepared-renderer.ts`、`packages/vario-vue/src/runtime/vnode-pipeline.ts`、`packages/vario-vue/__tests__/prepared/feature-parity.test.ts`
  - **参考**：`packages/vario-vue/src/renderer.ts`、`packages/vario-vue/src/features/vario-node.ts`
  - **复用**：AttrsBuilder、DirectiveHandler、RefsRegistry、defaultPlugins 和 Phase 0 fixture。
  - **验收**：legacy/region 使用同一 contract fixture；directive/ref/model/event/plugin/slot/Teleport 等语义等价；render 内不写默认 state/建 timer/type。
  - **预估**：4h
  - **依赖**：T2.4、T2.5、T2.6

- [x] **T2.8**: prepared mode 移除根 deep watch 与整树重建
  - **描述**：让 StateBridge 成为 prepared state 更新唯一调度源，Schema revision 走独立 PreparedView shallowRef 通道。
  - **产出物**：`packages/vario-vue/src/composables/internal/use-vario-phases.ts`、`packages/vario-vue/src/composable.ts`、`packages/vario-vue/__tests__/prepared/no-root-watch.test.ts`
  - **参考**：`setupWatchers` 的 `{ deep:true, flush:'sync' }` 和根 scheduler。
  - **复用**：T2.1 Session、T2.2 StateBridge、T2.7 PreparedRenderer 与 legacy mode fallback。
  - **验收**：prepared mode 不注册 deep state watcher、不调用 root render scheduler；全部写通道命中 ChangeSet；Schema replace/patch 仍正确。
  - **预估**：4h
  - **依赖**：T2.2、T2.7；且 T1.6 dependency-version 门禁全绿

- [x] **T2.9**: 执行区域更新、深度与 feature parity 门禁
  - **描述**：在 production browser 验证 `AΔ`、无关 state、`D≤100`、static component budget、API 与 Vue feature。
  - **产出物**：`packages/vario-vue/__tests__/prepared/region-routing.test.ts`、`packages/vario-vue/__tests__/browser/region-performance.test.ts`、`benchmarks/vue-depth/baseline/stable-regions.json`
  - **参考**：总门禁 PERF-A2/A3/T2～T4/D2、VUE-4 与专项 AC-05～AC-10。
  - **复用**：T0 browser runner、T0/T2 counters、T2.7 parity fixture。
  - **验收**：1000 节点 leaf p95≤8ms；无依赖 region render=0；静态千节点组件数非线性 N；正常交互无 >50ms library long task。
  - **预估**：3h
  - **依赖**：T2.8

## 阶段出口

- [x] prepared mode 的普通 state update 不经过根 deep watch/renderer。
- [x] Dynamic/Static/Boundary 正确性与性能门禁全绿。
- [x] legacy 仍可按 Session 回退；尚不授权大 loop、SSR 或多页面生产。

