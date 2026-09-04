# Changelog

## [Unreleased]

### Fixed

- **computed 同步链断裂（表单提交仍灰/待办统计不变/购物车总价与徽标冻结）**：`registerComputed` 的同步 watch 曾用 `ctx._get(key)`（getter 恒返回最新值）作比较基准，新值与基准恒相等导致失效被永久跳过、表达式缓存冻结。改为闭包内维护 `lastSynced` 基准，值变化即 `invalidateCache(key)` + `recordChange(ctx, key, val)`；computed 键不回写 state（getter-only 属性经 proxy set 会抛 TypeError），读取始终走 getter。
- **computed 失效滞后一帧（结算徽标冻结到下次交互）**：同步 watch 补 `flush: 'sync'`。深度 state watch（同为 sync）在突变时同步排队渲染微任务，若 computed watch 走默认 `'pre'`（flushJobs 队列），渲染可能先于失效执行——本帧命中陈旧缓存，失效发生在渲染后且无人再渲染。
- **VarioNode 路径栈错位（编辑弹窗保存/取消关不掉、搜索过滤空白）**：组件化路径曾把压入自身 model 段后的 `currentModelPathStack` 传给自身 `renderer.buildAttrs`，扁平 model `'x'` 被拼成 `'x.x'`，`getPathValue` 得 undefined 后默认值预写 `_set('x.x','')` 把标量 state 键替换为 truthy 嵌套对象（`editDialogVisible` 永真）。改为传原始 `props.modelPathStack`（buildAttrs 内部自行处理 scope 压栈）。
- **`onStateChange` 选项失效**：`UseVarioOptions` 从未声明该选项且 `initRuntimeContext` 硬编码 no-op。补类型声明并透传到 runtime ctx。
- **ExecutionSession 泄漏（首次事件后全部 ACTION_TIMEOUT）**：`execute` finally 解绑会话；loop 迭代共享父会话并在结束后解绑；过期/取消会话在读取时顺手清理。
- **legacy 表达式视图冻结（`state.count++` 不刷新）**：`$event/$self/$parent/$siblings/$children` 等特殊根参与缓存键；ResultMemo 前缀失效双向 `matchPath` 传播；对象/数组/undefined 结果不入 memo。
- **自定义指令首次更新后消失**：legacy 渲染迁移到 `VarioLegacyRoot` 内部组件（`withDirectives` 必须在 render 函数内调用）。
- **卸载清空宿主共享 reactive state**：`dispose` 只断引用，不再重置/清空宿主传入的 state 对象；disposed 后 `_set` 静默忽略并 emit `SESSION_DISPOSED_WRITE` 诊断。
- **作用域插槽遮蔽 `$item/$index`**：插槽改为 `createScopeContext` 每帧重建，词法转发不再覆盖 loop 绑定。
- **表达式白名单过度收紧**：恢复静态方法放行（`Math.*`、`JSON.*`、`Object.keys` 等）；`reverse/sort` 仅链式调用放行（`list.slice().reverse()`），直接调用拒绝并提示。
- **`$event` 缓存串值**：事件帧按 id 登记/释放（`createEventFrame`/`releaseFrame`），脱离同步栈顶约束。
- **`$item.*` 写入丢失**：loop ctx `_set` 首段为 `$item`/itemKey 时写回绑定对象并按 `itemsPath.index.rest` 记录变更。
- **`emit` 默认 payload**：未提供 `data` 时 payload 为 `undefined`（不再回退为 `$event`）。
- **batch 原子性**：回滚改为记录每次 `_set` 的 `(path, oldValue)` 逆序恢复，回滚写入绕过会话写校验。
- **prepared 循环 `$item` 丢失/别名串行/生命周期**：`LoopItemCell` 持有 loopCtx 跟随组件生命周期；别名进入 localDeps（plan id 含别名集合）；lifecycle/ref/全局组件解析对齐 legacy。
- **prepared 变更路由补全**：`{{ list.slice(0,5) }}` 循环、`model:'form.name'` 写回、整表替换后 cell 跟随 region token 重渲染；数组下标写入级联 `parent.length`。
- **SSR ctx 复用**：`renderSsrToString` 改 `session.detach()`（不 dispose 调用方 ctx）；hydrate 复用同一 ctx 时 `_set` 不再抛 Session disposed；engine 会话表不随挂载次数增长。

### Changed

- **`vnode.value` 形态**：有组件实例的 legacy 模式下为 `VarioLegacyRoot` 组件 vnode（承载 render 函数）；prepared 模式为 `VarioRoot` 组件 vnode。
- **`watch(schemaRef)` 非 deep**：只有根引用变化触发重渲染；就地修改请用 `patchNode`/`find().patch()` 或替换引用。
- **prepared 默认 `virtualAdapter = null`**：全量渲染；超 `maxLoopItemsPerRegion` 时 emit `LOOP_LARGE_LIST` 诊断不截断；虚拟化需显式传 reference adapter。
- **prepared 默认开启 `deepStateWatch`**：直接修改 state 可触发精确失效；`runtimeBudget.deepStateWatch: false` 可关闭（仅 `_set` 路径更新，写入更快）。
- **engineId 缺省 `'default'`**：多页面默认共享 engine materials（单页 dispose 不清空）；需要隔离的页面/SSR 请求显式指定 `engineId`。

### Added

- **回归测试（本轮 demo 症状）**：`vue __tests__/regression/computed-sync.test.ts`（表单/待办/购物车结算含同步失效断言）、`dialog-model.test.ts`（组件化路径栈不污染 model）、`dialog-element-plus.test.ts`（真实 Element Plus ElDialog 端到端开关验证）。
- **`compileExpressionPlan(source, { aliases })`**：loop 别名进入 localDeps，prepared 别名循环各行取值独立。
- **`createScopeContext` / `createForwardingContext` / `getParentContext`**：词法作用域上下文工具（core 导出）。
- **`RuntimeSession.release()`**：从 engine 摘除但不标记 ctx disposed（SSR detach 用）。
- **回归测试**：core `__tests__/regression/`（7 文件）、vue `__tests__/correctness/`（5 文件）、`__tests__/prepared/`（13 文件），覆盖本次全部回退类别。

### 历史（Unreleased 原始记录）

Prepared runtime, ScopeFrame, SSR session isolation, and Chrome heap/perf runners are in tree. Default `getRuntimeMode()` remains `legacy`. Loop cells use stable vnode keys (do not recycle mounted vnodes). Custom components / named slots / lifecycle / Vue feature nodes classify as semantic regions. Fast native path no longer treats PascalCase/custom tags as HTML. Capabilities require explicit registry (`allowInExpression`/`inputLimit`). Same-tick token bumps coalesce. Production admission is not granted until every architecture-audit gate has raw evidence.

### 2026-09-01 门禁闭环与验收落地

- **VM-6**：内建 action registry 改为无原型对象 + own-lookup + 阻断名单，`constructor/toString/__proto__` 不再被当作 handler 解析。
- **默认 runtime 对齐**：`getRuntimeMode()` 默认回退 `legacy`（prepared 保持显式 opt-in），消除与文档/CHANGELOG 的矛盾，修复 25 个 legacy 测试回归（vue 全量 507/532 → 532/532）。
- **eslint 0 error / 0 warning**（`packages/ --max-warnings 0`）。
- **compiled 缓存**：`expression/compiler.ts` 满容量改 LRU 淘汰 1 项并刷新命中位置，不再整表清空（SEC-4）。
- **深链 prepare**：`collectExpressionSources` 改显式栈 + SchemaNode 守卫，消除 10,000 层链 O(N²) 重扫与递归栈溢出（16.8s/5轮 → 0.2s/5轮）；PERF-T1 测试按固定 runner 协议补预热。
- **vue tsc 修复**：`use-vario-phases` 泛型签名、`event-handler` 类型断言与 unused 参数；五包 `tsc --noEmit` 全过。
- **验收**：core 305/305、schema 100/100、vue 532/532、cli 14/14、consumer 10/10；docs/architecture-audit 51 项任务与 22 条 AC 全部勾选；库级 G6 Production Core 授予（PERF-D4 真实应用 RUM 与生产 SSR 集群为仓库外评审项）。

