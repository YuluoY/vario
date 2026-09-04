# 子方案 03：Vue 3 稳定根与动态区域

> 状态：待实施 | 阶段：Phase 2  
> 关联：[总方案](./README.md) · [任务](../tasks/phase2-vue-stable-regions.md)

## 目标

把 prepared mode 的 Vue 更新从“状态变化后重新生成根 VNode”改为“稳定组件图中只有依赖 token 变化的区域更新”。本阶段同时固定 lifecycle/error 边界，并统一 legacy/region 两条 VNode feature pipeline。

## 组件图

```text
VarioRoot(sessionId, rootNodeId)
  ├─ StaticRegion(sessionId, regionId)
  ├─ DynamicRegion(sessionId, regionId)
  │    └─ native/material VNodes
  ├─ LoopRegion(sessionId, regionId)
  ├─ SlotRegion(sessionId, regionId, scopeId)
  └─ fixed semantic boundaries
       ├─ LifecycleBoundary
       └─ ErrorBoundary
```

组件 type 在模块加载时定义一次。组件 props 只允许 stable primitive ID、key 和必要 revision；PreparedView、StateBridge、registry、renderer 通过 typed injection key 获取稳定 Session service。

## PageSession 与 Vue 容器

| 数据 | 表示 | 更新方式 |
|---|---|---|
| PreparedView | `shallowRef<PreparedView>` | Schema revision 时替换引用 |
| Session service | `markRaw(PageSession)` | identity 全生命周期稳定 |
| PreparedNode/Plan | frozen/readonly + 可选 `markRaw` | 不原位修改 |
| region token | `shallowRef<number>` | ChangeSet 命中时递增 |
| business state | `reactive`/现有 refs | 正常 Vue 深层依赖 |
| loop item | 保持来源响应性 | cell 内读取，不 markRaw |

`effectScope` 管理 Session 内部 watcher/computed/subscription；所有 timer、AbortController、ref registration 同时登记到 Session cleanup registry。

## StateBridge 路由

1. StateStore 完成 transaction，生成去重的 changed path tokens 与版本。
2. StateBridge 使用 PreparedView dependency index 找到 region IDs。
3. 对同一 tick 的 region IDs 去重，只递增一次 region token。
4. DynamicRegion render effect 读取 token、PreparedNode 与真实 reactive state。
5. Vue 自行 patch 该区域 VNode；未命中的区域不 render。

动态 prefix/wildcard 依赖可命中更大 conservative region，但必须带原因计数；禁止偷偷退回全页又报告“局部更新”。

## StaticRegion 规则

- 每个 mount/Session 实例创建自己的 VNode，不跨实例复用已经挂载的 VNode。
- 普通 state ChangeSet 不触发 static interpreter。
- plan revision、material registry revision 或父结构改变时才重建。
- 包含 ref、directive、lifecycle、provide/inject、dynamic component、slot scope、Teleport、Transition、KeepAlive 或 plugin side effect 的节点不能标静态。
- 大静态区内部可以直接生成原生/物料 VNode；不为每个节点创建 Vue 组件。

## 固定边界

### LifecycleBoundary

- module-level `defineComponent`，通过 nodeId 从 Session 解析最新 hook plan。
- mount/update/unmount hook 每个语义事件只调用一次。
- async hook 由 Session execution registry 管理，dispose 后结果不得写回。
- provide/inject 的 provider identity 不因普通 update 改变。

### ErrorBoundary

- 使用 `onErrorCaptured` 覆盖 descendant setup/render/update。
- diagnostic 含 sessionId/nodeId/regionId/schemaPath/phase/cause。
- fallback 与 retry 在同一稳定边界内执行；retry 不新建无关 Session。
- compiler/depth/budget error 在 mount 前处理；不能依靠 Vue boundary 捕获结构输入错误。

## 统一 VNode pipeline

legacy renderer 与 PreparedRenderer 共用以下 adapter/contract fixture：

```text
component resolve
→ static/dynamic attrs
→ model bindings
→ events/modifiers
→ children/slots
→ directives
→ ref registry
→ lifecycle/error/provide
→ plugin decorators
→ Teleport/Transition/KeepAlive
```

不得在 `renderer.ts` 和 `vario-node.ts` 继续维护两套 feature 后处理。model default 在 Session 初始化 transaction 中完成，lazy model timer 归 Session 管理，不在 render 中写 state 或创建 timer。

## 删除 deep watch 的硬前置

只有以下项目全部通过，prepared mode 才能删除 `watch(state, { deep: true })`：

1. Proxy 直写、`ctx._set`、VM set/array、model、namespace refresh 和 batch 全部生成 ChangeSet。
2. ExpressionPlan 的 exact/prefix/dynamic dependency 有 mutation matrix。
3. result memo 使用 dependency versions，值变更不命中旧结果。
4. StateBridge 对同 tick 写入去重，最终 DOM 正确。
5. shadow/legacy fixture 没有陈旧 UI 或漏通知。
6. schema revision 使用独立通道，替换/patch 后结构仍刷新。

删除仅发生在 prepared mode；legacy mode 在迁移期保留旧 watcher，方便按 Session 回滚。

## Vue 3.4/3.5 兼容

- 两个版本均使用 Composition API、`setup()`、module-level components 和 TypeScript。
- Vue 3.4：以 `effectScope.stop()`、订阅门控和必要时重建 scope 实现 pause/resume fallback。
- Vue 3.5：feature detect 后可调用 scope pause/resume；不得静态假设方法存在。
- `onScopeDispose` 用于 composable 内部资源；PageSession 显式 `dispose()` 仍是宿主和非组件调用的最终保障。

## 测试与出口

| 门禁 | 通过条件 |
|---|---|
| stable root | 普通 state 更新不替换 VarioRoot instance/identity，不调用 legacy 根 renderer |
| dependency routing | 无依赖 region render=0；单叶只 render `AΔ + 必要祖先` |
| state scale | `S=100..20,000` operation counter 不遍历整图，耗时不再线性增长 |
| static skeleton | 1000 静态节点内部组件数不随 N 线性增长 |
| lifecycle | update 后 mounted=1、unmounted=0、updated=1 |
| errors | setup/render/update throw 均到 fallback/diagnostic |
| feature parity | model/event/slot/directive/ref/plugin/Teleport 等共享 fixture 全部通过 |
| browser | 1000 节点单叶 p95≤8ms，无 >50ms library long task |

## 回滚

prepared mode 每 Session 可切回 legacy；StateStore 保留与 legacy RuntimeContext 同步 adapter，回退不重载 Schema。若某 feature 尚未通过 parity，compiler 标记该页面/区域 incompatible，并在 canary 前整页使用 legacy，不能在同一语义边界混出不确定行为。

