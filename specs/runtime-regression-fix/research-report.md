# 运行时回退修复 调研报告

> 日期: 2026-09-03 | 作者: huyongle | 关联 spec: [spec.md](./spec.md) | 状态: 已完成

## 调研目标

- 本次未提交的 git 更改（`0d513af` 之后的工作区，107 个已跟踪文件 + 约 170 个新增文件）在默认 `legacy` 运行时下，具体哪些行为相对 HEAD 发生了回退？
- 用户反馈的"指令、事件、响应式多方面出问题"分别对应哪条代码路径？能否用最小用例稳定复现？
- 为什么 vue 69 文件/533 用例、core 38 文件/305 用例全绿却没有拦住这些回退？
- 每类回退的修复方案有哪些候选，各自对既有 prepared 运行时设计（ResultMemo / ScopeFrame / PageSession）的侵入程度如何？

## 知识缺口与结论

| 缺口编号 | 知识缺口 | 调研深度 | 信息源 | 结论 | 可信度 |
|---------|---------|---------|--------|------|--------|
| KG-1 | 首次事件 5 秒后为何所有事件、`_set`、v-model 全部报 `ACTION_TIMEOUT` | L3（源码 + 复现） | 项目源码 `vario-core/src/vm/executor.ts:56-79`、`execution-session.ts:131-149` + 复现脚本 | `bindExecutionSession` 后 `dispose()` 不解绑，第二次 `execute` 复用过期 session；`_set` 内 `assertSessionCanWrite` 查到同一 session | 高 |
| KG-2 | legacy 模式下直接改 reactive state（文档推荐写法 `state.count++`）为何视图冻结 | L3 | `vario-vue/src/features/expression-evaluator.ts:21-31`、`runtime/page-session.ts:108-112`、`vario-core/src/expression/result-memo.ts:55-62` + 复现 | legacy 根 ctx 能查到 PageSession → 表达式改走 `evaluateExpressionPlan` + `ResultMemo`；memo 只在 `recordChange` 时 bump，且精确路径比对，无前缀传播 | 高 |
| KG-3 | 为何仓库测试没有暴露 KG-1/KG-2 | L2 | `__tests__/composable-enhanced.test.ts:29-48`、`__tests__/prepared/*.test.ts`、`__tests__/vm/executor.test.ts:709-716` | 用例全部用 `ctx._set` 改状态且在 5 秒内完成；事件用例连点在同一 tick（frame 泄漏使 memo generation 漂移，恰好掩盖陈旧命中）；新增测试甚至把 session 残留断言为预期 | 高 |
| KG-4 | 表达式白名单收紧后哪些原本可用的调用失效 | L3 | `git diff HEAD -- whitelist.ts evaluator.ts` + 复现 | `Math.pow/Math.random`、`Object.keys/values/entries`、`Array.from`、`reverse/sort` 由可用变为 `AST validation failed`；字符串/数字/日期实例方法在 HEAD 即被 evaluator 运行时拒绝，不属回退 | 高 |
| KG-5 | 作用域插槽内 `$item`/`$index` 为何变成插槽参数与 -1 | L3 | `children-resolver.ts:102-106` + 复现 | 插槽 ctx 改用 `createLoopContext(ctx, scope, -1)`，把插槽参数写成 `$item` 并把 `$index` 置 -1 | 高 |
| KG-6 | 自定义指令为何在第一次状态更新后消失 | L3 | `composable.ts:253-256`、`renderer.ts:495-503`、Vue `withDirectives` 约束 + 复现 | 首帧在宿主 render 函数内渲染（指令生效），后续 scheduler 在 `nextTick` 中调 `render()`，`withDirectives` 不在 render 函数内被 Vue 丢弃并告警 | 高 |
| KG-7 | 卸载后宿主共享的 reactive state 为何变成 `{}` | L3 | `adapter.ts:76-89`、`page-session.ts:257-264`、`composable.ts:262-265` + 复现 | `PageSession.dispose → releaseVueAdapter → delete toRaw(state)[key]`，而 `isReactive(options.state)` 时复用的就是宿主对象 | 高 |
| KG-8 | prepared 模式循环事件为何拿到空 `$item` | L3 | `components/loop-item-cell.ts:80-96`、`loop-context-pool.ts:107-115` + 复现 | render 结束即 `releaseLoopContext`，事件闭包持有的 Proxy locals 被清空，读取回落到父 ctx | 高 |
| KG-9 | prepared 模式自定义 `itemKey` 别名为何各行同值 | L3 | `plan-compiler.ts:7,37-39`、`plan-evaluator.ts:28-36` + 复现 | `LOCAL_PREFIX` 硬编码 `item/index/row/cell`，别名 `user.name` 被当 stateDeps，同层 scopeGeneration 相同 → memo 跨行命中 | 高 |
| KG-10 | 事件 scope frame 是否泄漏 | L3 | `event-handler.ts:364-368, 504-509` + 复现 | 只在"自己是栈顶"时 `popScope`，异步事件交叠时前一帧永久残留；三次快速点击后 `frames.size === 2` | 高 |
| KG-11 | `$event/$self` 表达式是否跨事件串值 | L3 | `cache.ts:51-55`、`proxy.ts:57-64` + dist 复现 | `isCacheValid` 只剩 TTL，`$event` 赋值不失效缓存 → `{{ $event.target.value }}` 两次事件均返回首个值 | 高 |
| KG-12 | `_set('$item.x')` 是否被路径策略拦截 | L3 | `path-policy.ts:42-49` + dist 复现 | 所有 `$` 根都被判系统路径，抛 `PATH_FORBIDDEN_SEGMENT` | 高 |
| KG-13 | Vue reactive 对 `Object.prototype.hasOwnProperty.call(obj, key)` 是否追踪依赖 | L2 | Vue 3.5.27 实测（effect 只跑一次）+ Vue 源码 `baseHandlers` 无 `getOwnPropertyDescriptor` 陷阱 | 不追踪；`path.ts:139-145` 的 own-property 读取会让"尚不存在的键"失去依赖收集 | 高 |
| KG-14 | Vue `withDirectives` 能否在 render 函数外使用 | L2 | Vue runtime-core `directives.ts`（`currentRenderingInstance` 为空即告警并原样返回 vnode） | 不能；必须在组件 render 函数栈内调用 | 高 |
| KG-15 | `pauseTracking/resetTracking` 是否可从 `vue` 包导入 | L1 | Vue 类型定义（属 `@vue/reactivity` 内部导出，`vue` 主包不保证公开） | 不作为公开 API 依赖；采用内部组件承载 render 的方案 | 中 |

## 技术可行性

| 调研项 | 结论 | 来源 | 可信度 | 备注 |
|--------|------|------|--------|------|
| `execute()` 结束后解绑 ExecutionSession 不影响嵌套 `runChild` | 可行 | `executor.ts:82-92` `runChild` 通过 `getExecutionSession(ctx)` 取活跃 session；`finally` 解绑发生在最外层 | 高 | 需保证 `existing` 分支只复用"活跃且未 cancel"的 session |
| legacy 模式让 `ExpressionEvaluator` 直接走 `evaluate()`（旧 per-ctx 缓存） | 可行 | `evaluate.ts:27-66` 保留完整旧路径；`invalidateCache` 双向 `matchPath` 语义与 deep watch 的 `flushPending` 对齐 | 高 | prepared 区域组件仍可继续用 `evaluateExpressionPlan` |
| `ResultMemo.bump` 改为前缀/祖先传播 | 可行 | `result-memo.ts` 的 `versions` 是 `Map<string, number>`，可维护"已见依赖索引"并按 `matchPath` 双向 bump | 高 | 每次 bump 成本 O(已见依赖数)，需限流或索引前缀树 |
| 在 legacy 模式把渲染放进内部组件（`VarioLegacyRoot`）以满足 `withDirectives` 约束 | 可行 | prepared 分支已有同型实现 `h(VarioRoot, { key: viewRevision })`（`composable.ts:206-212`）；测试与文档均不依赖 `vnode.value.type` | 高 | `vnode.value` 由元素 vnode 变为组件 vnode，属可接受的形态变化 |
| 作用域插槽改用独立 `createScopeContext`（不带 `$item/$index`） | 可行 | `loop-context-pool.ts:80-99` 的 Proxy 转发结构可复用；只需去掉 `$item/$index` 注入并加标记 | 高 | `event-handler.isInScopedSlot` 需改为按标记判定 |
| 事件 frame 按 id 释放（脱离栈顶约束） | 可行 | `scope-frame.ts:43-45` `releaseScopeFrame(table, frame)` 本身就是按 id 删除 | 高 | `frameStack` 仅保留给同步渲染期 push/pop |
| dispose 只断引用不删 key | 可行 | `adapter.ts` 的 `held = null` 已让所有读写短路 | 高 | 需同步去掉 `page-session.ts:261-264` 删 `$methods` |
| prepare 阶段为 loop 模板注入别名作为 localDeps | 可行 | `compileLoopPlan` 已知 `itemKey/indexKey`；`compileExpressionSources` 按节点编译，可传入祖先 loop 的别名集合 | 高 | plan id 需包含别名集合，避免同源不同作用域串 plan |

## 业界方案对比

### 对比维度：表达式结果缓存的失效策略

| 方案 | 参考 | 优点 | 缺点 | 本项目适用性 |
|------|------|------|------|------------|
| A. 精确路径版本号（现状 `ResultMemo`） | `result-memo.ts` | O(1) bump | 父路径替换、数组整体替换、`.length` 全部漏失效 | ❌ 不适用（已复现 6 类漏失效） |
| B. 双向前缀匹配（旧 `cache.ts` + `matchPath`） | `cache.ts:131-150` | 语义正确、与 deep watch 路径采集一致 | 每次失效 O(缓存条目数) | ✅ legacy 沿用 |
| C. 前缀树版本 + 祖先链聚合 | 通用响应式库（如 MobX derivation 依赖树） | bump O(路径深度)，查询 O(依赖数 × 深度) | 实现复杂度高 | ⚠️ prepared 的 memo 可作为第二步优化 |
| D. 世代号兜底（`nextGeneration`） | `result-memo.ts:46-49` 已有 | 实现最简单 | 任何变更全量失效，等价于无 memo | ⚠️ 作为无法定位路径时的兜底 |

### 对比维度：事件执行期的作用域帧管理

| 方案 | 参考 | 优点 | 缺点 | 本项目适用性 |
|------|------|------|------|------------|
| A. 栈式 push/pop（现状） | `page-session.ts:184-199` | 与同步渲染期天然匹配 | 异步事件交叠必然泄漏 | ❌ 不适用于事件 |
| B. 按 id 的帧表 + 显式 release | `scope-frame.ts:43-45` | 与异步生命周期匹配 | 需要调用方持有 frame 引用 | ✅ 事件用此方案 |
| C. 事件不创建 frame，`$event` 直接挂 ctx | HEAD 行为 | 最简单 | 失去 ScopeFrame 词法查找的一致性 | ⚠️ 可作为 legacy 的降级选项 |

### 对比维度：legacy 渲染宿主

| 方案 | 参考 | 优点 | 缺点 | 本项目适用性 |
|------|------|------|------|------------|
| A. 宿主 render 函数内 getter 触发渲染（现状） | `composable.ts:253-256` | 无新组件 | 宿主 effect 追踪整棵 state → 双重渲染；scheduler 渲染在 render 函数外 → 指令丢失 | ❌ |
| B. 内部组件 `VarioLegacyRoot` 承载渲染，宿主只渲染 `h(LegacyRoot, { key })` | prepared 的 `VarioRoot`（`components/vario-root.ts`） | 满足 `withDirectives` 约束；宿主不再追踪 state；与 prepared 形态统一 | `vnode.value` 形态变化 | ✅ |
| C. `pauseTracking` 包裹 + `$forceUpdate` | Vue 内部 API | 改动小 | 依赖非公开导出（KG-15） | ❌ |

### 对比维度：`$item.*` 词法变量写入

| 方案 | 参考 | 优点 | 缺点 | 本项目适用性 |
|------|------|------|------|------------|
| A. 一律拒绝（现状） | `path-policy.ts:42-49` | 简单 | 破坏 HEAD 可用能力 | ❌ |
| B. loop ctx 的 `_set` 先解析词法绑定，再写入绑定对象并按 `itemsPath.index.rest` 记录变更 | 类似 Vue `v-for` 中直接改 `item.x` | 语义直观、变更路径可定位 | 需要 loop ctx 知道 `itemsPath` | ✅ |
| C. 只放行 `$item.*` 写到 state 根 | — | 改动最小 | 会在 state 上创造 `$item` 键，语义错误 | ❌ |

## 性能/安全基准

| 指标 | 调研项 | 当前基准（本次测试输出） | 来源 | 本项目目标 | 依据 |
|------|--------|---------|------|-----------|------|
| 性能 | 1000 项列表追加 1 项（median） | 11.35ms | `__tests__/comprehensive-perf-report.test.ts` 本次运行 | 修复后不劣于 12.5ms（≤ +10%） | 去掉 legacy 无用的 bridge 全表扫描后应持平或更好 |
| 性能 | 5000 项初始渲染（median） | 40.95ms | 同上 | ≤ 45ms | 同上 |
| 性能 | 8 层 2 分支深嵌套初始渲染 | 7.88ms | 同上 | ≤ 8.7ms | `scanSchemaIterative` 改为按 schema 引用缓存后应下降 |
| 性能 | 仪表盘仅改表格首行（20 面板+200 行） | 15.43ms | 同上 | ≤ 17ms | legacy 回到旧缓存路径，无 memo 开销 |
| 安全 | 表达式白名单 | `Math/Object/Array/Date` 静态方法在 HEAD 可用 | `git show HEAD:.../whitelist.ts` | 恢复 HEAD 可用面；`Object.assign/defineProperty/setPrototypeOf` 等继续禁止 | 不扩大攻击面 |
| 安全 | 路径写入 | 禁止 `__proto__/constructor/prototype`，禁止覆盖 `$methods/_get/_set` | `path-policy.ts:14-35` | 保持；仅放行词法绑定子路径 | 原型污染防护不变 |

## 已知风险与坑点

| 风险/坑点 | 来源 | 影响评估 | 缓解措施 |
|----------|------|---------|---------|
| 新增测试把错误行为固化（`executor.test.ts:709-716` 断言 session 残留；`emit.test.ts:29-36` 断言 `$event` 作为默认 payload；`loop-model-event.test.ts:158-160` 把 204 项截断当预期） | 本次 diff | 修复时这些测试会红 | 随修复同步改写断言，并在 verification 中逐条说明 |
| legacy 与 prepared 共用 `ExpressionEvaluator`/`EventHandler`，按 `getPageSessionForContext` 分流 | `expression-evaluator.ts:22`、`event-handler.ts:365` | 修 legacy 时容易误伤 prepared | 用显式 `runtimeMode` 或 `session.bridge != null` 分流，不再用"能否查到 session"推断 |
| `createLoopContext` 的 Proxy `getPrototypeOf` 返回 `Object.prototype`，使 `getPageSessionForContext/getExecutionSession` 在 loop ctx 上都查不到 | `loop-context-pool.ts:96-98` | 既掩盖了 legacy 循环内的 memo 问题，也导致 loop 迭代新建 ExecutionSession | 显式维护 `loopParents: WeakMap<loopCtx, parentCtx>` 并让两处查找回落父 ctx |
| Vue 3.5 reactive 不追踪 `hasOwnProperty.call` | KG-13 | 改 `path.ts` 读取方式后需回归 Vue 依赖收集 | 用 `in` 判断 + `Reflect.get`，对危险段单独拦截 |
| `pnpm-lock.yaml` 变更但 `packages/vario-core/node_modules` 缺 vitest | 本次运行 `pnpm --filter @variojs/core test` MODULE_NOT_FOUND | CI/本地 `pnpm test` 直接失败 | Phase 4 执行 `pnpm install` 并把 `pnpm test` 纳入门禁 |

## 综合建议

### 推荐方案
- 按"core 契约 → legacy 运行时 → prepared 对齐 → 门禁与文档"四个 phase 模块化修复；每个 phase 独立可合并、独立可回滚。
- legacy 模式回到"旧表达式缓存 + deep watch"的正确性基线，不再让根 ctx 的表达式走 `ResultMemo`；`ResultMemo` 只服务 prepared 区域组件，并修正为前缀失效。
- 把本次审查的全部复现用例固化为 `__tests__/correctness/` 与 `vario-core/__tests__/regression/` 的正式回归测试，作为 Phase 7 的门禁。
- **理由**: 复现用例证明回退集中在"新旧两套机制在 legacy 下混用"的接缝处（memo/session/frame/loop ctx），把接缝切清比继续打补丁更可靠。
- **关键依赖**: `runtimeMode` 需在 renderer/evaluator/event-handler 中可显式获得（目前只在 composable 层）。

### 替代方案（已排除）
- 直接回滚整个工作区到 HEAD：丢失 prepared 运行时、安全加固、性能基建等大量有效工作，且 HEAD 本身有指令从未生效、`$item` 写到父 ctx 等旧 bug。
- 只修 ExecutionSession 泄漏：能消除 5 秒超时，但 memo 陈旧、指令消失、共享 state 被清空仍在。

### 待确认项
- [ ] `vnode.value` 由元素 vnode 变为 `VarioLegacyRoot` 组件 vnode 是否有下游依赖（docs 仅 `error-handling.md`/`performance-benchmarks.md` 提及，需人工确认使用方式）
- [ ] prepared 模式是否接受"state 恢复 deep reactive"以支持直接改 state（当前 shallowReactive 是性能取舍）
- [ ] `Math.random` 等 impure 调用恢复放行后，是否需要在 SSR 场景给出确定性提示

## 参考资料

### Context7
- N/A（本次调研以项目源码与本地复现为主，Vue 行为直接对照 Vue 3.5.27 源码与实测）

### GitHub
- N/A

### WebSearch
- N/A

### Stack Overflow
- N/A

### 项目源码
- `packages/vario-core/src/vm/executor.ts`、`vm/execution-session.ts`
- `packages/vario-core/src/expression/{cache,evaluate,result-memo,plan-compiler,plan-evaluator,whitelist,policy}.ts`
- `packages/vario-core/src/runtime/{create-context,proxy,path,path-policy,loop-context-pool,change-set,runtime-session}.ts`
- `packages/vario-vue/src/{composable,renderer,adapter,bindings}.ts`
- `packages/vario-vue/src/composables/internal/{use-vario-phases,method-registry,computed-registry,invalidation-controller}.ts`
- `packages/vario-vue/src/features/{expression-evaluator,event-handler,children-resolver,loop-handler,node-context,lifecycle-wrapper,refs}.ts`
- `packages/vario-vue/src/runtime/{page-session,state-bridge,prepared-renderer,runtime-mode}.ts`
- `packages/vario-vue/src/components/{loop-item-cell,loop-region,dynamic-region,vario-root}.ts`
- `packages/vario-schema/src/compiler/{prepare-view,prepare-loop,prepare-expression}.ts`
- 复现记录：本轮审查中的临时用例（已删除）结果——legacy 13 项中 7 项失败、白名单 15 项中 12 项失败、prepared 3 项全部失败、ExecutionSession 2 项失败、指令/共享 state 2 项失败
