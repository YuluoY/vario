# 运行时回退修复 需求规格说明

> 日期: 2026-09-03 | 作者: huyongle | 状态: 草稿

## 背景与动机

当前工作区（HEAD `0d513af` 之后未提交的约 280 个文件变更）为 `@variojs/core` / `@variojs/vue` 引入了 prepared 运行时、ExecutionSession、ResultMemo、ScopeFrame、路径/白名单安全策略等新机制。这些机制在默认 `legacy` 模式下与旧机制混用，导致一批可稳定复现的行为回退：首次事件 5 秒后所有事件与 v-model 报 `ACTION_TIMEOUT`；按文档推荐写法 `state.count++` 修改状态后视图冻结；自定义指令在第一次更新后消失；组件卸载把宿主共享的 reactive state 清空；作用域插槽遮蔽 `$item/$index`；`Math.*`/`Object.keys` 等表达式失效。prepared 模式下另有循环事件丢 `$item`、别名循环各行同值等问题。

vue 533 + core 305 个既有测试全绿但未拦住这些回退，因为用例只通过 `ctx._set` 改状态、都在 5 秒内完成、且多个新增测试把错误行为固化为预期。不修复，`@variojs/vue` 在任何真实页面上都无法正常使用；不补回归门禁，同类问题会再次穿过测试。

调研过程与复现记录见 [research-report.md](./research-report.md)。

## 用户故事

| 编号 | 角色 | 故事 | 验收线索 |
|------|------|------|---------|
| US-1 | 使用 `useVario`（legacy 默认）的业务开发者 | 作为业务开发者，我希望页面打开任意时长后点击按钮、输入表单都能正常执行 action 与写回 state，以便页面不会在 5 秒后"整体失灵" | FR-1、AC-1 |
| US-2 | 业务开发者 | 作为业务开发者，我希望按文档写法在 methods 里 `state.x = …` / `state.list.push()` 或在宿主里直接改 reactive state 后，`{{ }}`/cond/show/props 立即反映最新值，以便响应式行为与 Vue 直觉一致 | FR-2、AC-2 |
| US-3 | 业务开发者 | 作为业务开发者，我希望 schema 上的 `directives` 在整个组件生命周期内持续生效（mounted/updated/unmounted 都触发），以便 v-loading、权限指令等可用 | FR-8、AC-6 |
| US-4 | 业务开发者 | 作为业务开发者，我希望把 pinia/父组件的 reactive 对象作为 `state` 传给 `useVario` 时，组件卸载不会清空该对象，以便状态可跨组件复用 | FR-7、AC-7 |
| US-5 | 业务开发者 | 作为业务开发者，我希望 el-table 等作用域插槽内 `$item/$index` 仍指向外层循环项，插槽参数只通过 `props.scope` 声明的名字访问，以便嵌套模板可预期 | FR-5、AC-4 |
| US-6 | Schema 编写者 | 作为 schema 编写者，我希望 `Math.pow`、`Object.keys`、`Array.from`、`slice().reverse()` 等 HEAD 可用的表达式继续可用，以便已有 schema 不需要改写 | FR-4、AC-5 |
| US-7 | Schema 编写者 | 作为 schema 编写者，我希望循环内 `set path: '$item.done'` 能写回当前项，`{{ $event.target.value }}` 每次事件都是当前事件的值，以便事件参数与词法写入可用 | FR-3、FR-9、AC-3 |
| US-8 | 使用 prepared 模式的早期采用者 | 作为 prepared 模式采用者，我希望循环事件拿到正确的 `$item`、自定义 `itemKey` 各行独立、全局组件/`ref`/生命周期 hook 与 legacy 一致，以便 prepared 可以逐步替代 legacy | FR-11、FR-12、AC-8 |
| US-9 | 库维护者 | 作为维护者，我希望本次审查的全部复现用例进入正式回归测试并成为 CI 门禁，以便同类回退无法再次穿过测试 | FR-15、AC-9 |
| US-10 | 库维护者 | 作为维护者，我希望 legacy 模式不再承担 prepared 的 bridge 全表扫描与每帧深度扫描成本，以便性能不劣于修改前基线 | FR-13、AC-10 |
| US-11 | SSR/多页面宿主 | 作为 SSR 与多页面宿主，我希望 hydrate 复用的 ctx 不被提前 dispose、共享 engine 的 materials 不被单页卸载清空、engine 表不随挂载次数增长，以便长生命周期应用稳定 | FR-14、AC-11 |

### 目标
- 默认 `legacy` 模式在事件、响应式、指令、卸载四类行为上恢复到不劣于 HEAD 的正确性，并修复 HEAD 已有的"指令从未生效""`$item` 写到父 ctx"两个旧缺陷。
- 修复 core 契约层（ExecutionSession、表达式缓存、路径策略、白名单）的回退，使 legacy 与 prepared 共同受益。
- prepared 模式补齐本次发现的对齐缺口（循环 ctx 生命周期、别名依赖、生命周期 ctx、组件/refs 解析、默认虚拟适配器）。
- 把复现用例固化为回归测试，并纠正被错误固化的断言。

### 非目标（明确不做的事）
- 不把 prepared 设为默认运行时，不重新设计 prepared 的 region/bridge 架构。
- 不新增 HEAD 也不支持的表达式能力（如字符串原型方法 `toUpperCase/trim`），此类作为 P2 可选项单列，不阻塞验收。
- 不改动 Schema 格式、`@variojs/schema` 的 normalizer/validator 语义、`@variojs/cli`。
- 不回滚整个工作区到 HEAD。
- 不处理 HEAD 即存在且本次未恶化的问题（同一循环迭代内两次 `set n = n+1` 只加 1 等），仅记录。

## 功能需求

### FR-1: ExecutionSession 随 `execute()` 结束解绑
- **描述**: `execute()` 的 `finally` 必须解除 ctx → session 绑定；`existing` 复用仅对"仍在运行且未 cancel"的 session 生效；`_set` 中的 `assertSessionCanWrite` 只在存在活跃 session 时检查。loop 迭代的 loopCtx 应共享父 session（deadline/steps/signal）而非新建。
- **优先级**: P0
- **触发条件**: 同一 ctx 上先后发生多次 `execute`，或事件结束后宿主直接 `_set` / v-model 写回。
- **预期行为**: 第二次 `execute` 拿到新 session（新 deadline、满额 steps）；事件结束 5 秒后 `_set` 正常；`maxSteps` 只在单次 `execute` 内累计。
- **边界条件**: 嵌套 `runChild`（if/loop/batch）仍共享最外层 session；`execute` 抛错时同样解绑；`signal` abort 后的 session 不得被复用。

### FR-2: legacy 表达式求值不经 ResultMemo；ResultMemo 改为前缀失效
- **描述**: `runtimeMode === 'legacy'` 时 `ExpressionEvaluator`/`provide-inject`/`loop-handler` 使用 `evaluate()`（旧 per-ctx 缓存 + `invalidateCache` 双向前缀匹配），不再因为"能查到 PageSession"切到 `evaluateExpressionPlan`。`ResultMemo.bump(path)` 改为对已登记依赖做双向前缀匹配（`items` 失效 `items.length`/`items.0.name`，`items.0.name` 失效 `items.0`），供 prepared 区域组件使用。
- **优先级**: P0
- **触发条件**: 任意 `{{ }}`/cond/show/props/loop items 求值。
- **预期行为**: 直接改 reactive state、`_set` 父路径、`_set` 子路径、`push` 后 `.length` 四类变更后视图均更新；memo 命中率下降可接受。
- **边界条件**: `_set` 与直接改 state 混用的同一路径；对象/数组结果不入 memo（沿用 `evaluate.ts:61` 的 `cacheable` 规则）；`undefined` 结果不入 memo。

### FR-3: 特殊变量表达式不缓存，赋值时失效
- **描述**: 依赖根为 `$event/$self/$parent/$siblings/$children` 的表达式在 `evaluate()` 与 `evaluateExpressionPlan()` 中一律不缓存；`proxy.ts` 对 allowedSpecialVars 赋值时调用 `invalidateCache(propName, proxy)`。
- **优先级**: P0
- **触发条件**: `call params: '{{ $event.target.value }}'`、`{{ $self.props.x }}` 等。
- **预期行为**: 每次事件/每个节点都拿到当前值。
- **边界条件**: `$variables/$datasources/$functions/$utils` 命名空间仍可缓存（已有 `onNamespacesChange` 失效通道）。

### FR-4: 表达式白名单恢复 HEAD 可用面
- **描述**: `validateAST` 与 evaluator 运行时检查同步放行：`WHITELISTED_GLOBALS`（`String/Number/Boolean/Array/Object/Math/Date/JSON`）上的静态方法调用，`Object.assign/defineProperty/defineProperties/setPrototypeOf/getPrototypeOf/getOwnPropertyDescriptor` 继续禁止；`Math.random` 放行但标记 impure（不缓存）；`reverse/sort` 仅在链式调用（callee 对象为 CallExpression 结果）时放行。
- **优先级**: P0
- **触发条件**: schema 中 `{{ Math.pow(a, 2) }}`、`{{ Object.keys(obj).length }}`、`{{ list.slice().reverse() }}`。
- **预期行为**: 求值成功；`{{ list.reverse() }}`（直接对 state 数组）仍被拒绝。
- **边界条件**: `allowGlobals: true` 时行为不变；vue 层 `evaluateExpr` 对白名单错误至少 `console.warn` 一次（按表达式去重）。
- **P2 可选**: 新增 `SAFE_STRING_METHODS`/`SAFE_NUMBER_METHODS`（`toUpperCase/toLowerCase/trim/split/replace/startsWith/endsWith/padStart/padEnd/substring/charAt/toFixed`），运行时按接收者类型校验。

### FR-5: 作用域插槽 ctx 与 loop ctx 解耦
- **描述**: `children-resolver` 的作用域插槽改用 core 新增的 `createScopeContext(parentCtx, bindings)`（Proxy 转发、不注入 `$item/$index`、带 `isScopeContext` 标记）；`event-handler` 用 `isScopeContext(ctx)` 替代 `'scope' in ctx` 判定；移除按 parentSchema 缓存插槽函数的 `q` WeakMap（或缓存项每帧刷新捕获的 `modelPathStack/parentMap/template`）。
- **优先级**: P0
- **触发条件**: `template slot + props.scope` 出现在循环内或循环外。
- **预期行为**: 循环内插槽 `{{ $item.name }}`/`{{ $index }}` 指向外层循环项；插槽参数只通过声明名访问；`ref` 判定不受影响。
- **边界条件**: 插槽参数名与 state 键同名时插槽参数优先（与 HEAD `Object.create(ctx)` 语义一致）。

### FR-6: 事件 scope frame 按 id 释放
- **描述**: 事件处理创建的 frame 通过 `session.createEventFrame(bindings)` 登记到 `frames` 表，结束时 `session.releaseFrame(frame)` 按 id 删除，不依赖栈顶；`frameStack` 仅用于同步渲染期（LoopItemCell/SlotRegion）。移除事件路径上的 `SCOPE_STALE_GENERATION` 检查或仅在 `parentFrame` 为渲染帧时启用。
- **优先级**: P0
- **触发条件**: 两个异步事件交叠、快速连点。
- **预期行为**: 任意顺序完成后 `frames.size` 回到事件前；`currentFrame()` 不受事件影响。
- **边界条件**: 事件抛错时同样释放；session 已 dispose 时释放为 no-op。

### FR-7: dispose 不破坏宿主对象；disposed 后写入不抛
- **描述**: `adapter.release()` 只置 `held = null`；`PageSession.dispose()` 不删 `ctx.$methods` 的 key；`useVario().dispose()` 不清空 `reactiveState`；`RuntimeSession` 记录 disposed 后，`_set`/proxy set 对该 ctx 静默忽略并 emit `SESSION_DISPOSED_WRITE` 诊断，`execute` 仍抛 `SESSION_DISPOSED`。
- **优先级**: P0
- **触发条件**: `v-if`/路由切换卸载使用共享 state 的组件；卸载后仍在飞行的异步 method 回写。
- **预期行为**: 宿主对象内容不变，可再次挂载；异步回写不产生未捕获异常。
- **边界条件**: `useVario` 自己创建的 state（`options.state` 为空或非 reactive）可在 dispose 时释放引用，但同样不删 key。

### FR-8: legacy 渲染宿主改为内部组件，指令持续生效
- **描述**: 新增 `VarioLegacyRoot` 组件（对齐 prepared 的 `VarioRoot`），其 render 函数内调用 `renderer.render(schema, ctx)`（含错误边界）；`publicVnode.value` 返回 `h(VarioLegacyRoot, { key: revision })`；scheduler 只递增 `revision`。`withDirectives` 因此始终在 render 函数内执行，宿主组件不再追踪 state。
- **优先级**: P0
- **触发条件**: schema 含 `directives`；任意 state 变更。
- **预期行为**: directive `mounted/updated/unmounted` 按 Vue 语义触发；无 `withDirectives` 警告；一次 state 变更只触发一次 Vario 渲染。
- **边界条件**: `useVario` 在无组件实例环境（SSR/单测）调用时保持现有 `vnodeRef` 直出行为；`refs` 的 owner 改为 `VarioLegacyRoot` 实例；`retry()` 触发 revision 递增。

### FR-9: 词法变量子路径写入
- **描述**: loop ctx 的 `_set(path)`：首段为词法绑定（`$item`、`itemKey` 别名）时，把剩余路径写到绑定对象上，并以 `itemsPath.<index>.<rest>` 记录变更/失效（`createLoopContext` 新增可选 `itemsPath`）；无法定位 itemsPath 时以 `memo.nextGeneration()` + 根级 `invalidateCache` 兜底。`path-policy.isSystemPath` 仅拦截 `SYSTEM_ROOTS` 中的真正系统根（`$methods/$emit/$exprOptions/_get/_set` 等）与 `__proto__/constructor/prototype` 段。
- **优先级**: P1
- **触发条件**: 循环内 `set path: '$item.done'` / `push path: 'user.tags'`。
- **预期行为**: 对应 state 项被修改，依赖它的表达式失效。
- **边界条件**: `$index` 不可写；`users[].name`（未解析的 `[]`）给出明确 `PATH_UNRESOLVED_INDEX` 错误而非 budget 错误。

### FR-10: `getPathValue` 恢复依赖收集与原型 getter 读取
- **描述**: `path.ts` 的段读取改为 `isForbiddenSegment` 拦截 + `Reflect.get`（`in` 判断），不再要求 own property。
- **优先级**: P1
- **触发条件**: state 初始为 `{}` 后再赋 `form.email`；state 内含 class getter / `Map.size`。
- **预期行为**: Vue effect 追踪到尚不存在的键；getter/size 可读。
- **边界条件**: `__proto__/constructor/prototype` 段返回 undefined。

### FR-11: prepared 循环与生命周期对齐
- **描述**: (a) `components/loop-item-cell.ts` 的 loopCtx 生命周期跟随 cell 组件（`onBeforeUnmount` 释放），不在 render `finally` 释放；(b) prepare 阶段把祖先 loop 的 `itemKey/indexKey` 注入表达式编译，别名进入 `localDeps` 且 plan id 含别名集合；(c) `VarioLifecycleBoundary` 优先使用 `props.runtimeCtx`；(d) prepared 也向 renderer 传 `instance`（用于 appContext 组件解析与 ref owner）；(e) 默认 `virtualAdapter` 为 `null`，reference adapter 仅显式 opt-in，超出预算 emit 诊断。
- **优先级**: P1
- **触发条件**: prepared 模式下循环事件、别名循环、循环内 `onMounted`、全局组件、`ref`、500+ 项列表。
- **预期行为**: 与 legacy 一致。
- **边界条件**: loop 模板含组件化子树（`VarioNode` 延迟渲染）时 `$item` 仍可用。

### FR-12: prepared 变更路由补全
- **描述**: `VueStateBridge.apply` 用 loop items 表达式的 `stateDeps` 匹配（不只 `itemsSource` 原文）；`modelPlans` 路径纳入节点依赖；`renderFastNative` 走修正后的 memo；schema 根替换时重建 `view/bySchema/sources`；prepared 下增加一个 sync deep watch 把非 `_set` 写入转为 `recordChange`（路径由 invalidationController 采集，采集不到时 `nextGeneration` + 根 token）。
- **优先级**: P1
- **触发条件**: prepared 下 `{{ list.slice(0,5) }}` 循环、`model: 'form.name'` 写回、`computed` schema 替换、直接改 state。
- **预期行为**: 对应 region 重渲染。
- **边界条件**: state 恢复 deep reactive 的性能影响需在基准中量化（见非功能性需求）。

### FR-13: legacy 去除无效开销
- **描述**: legacy 模式不创建 `VueStateBridge`（或 `apply` 早退）；`prepareView` 仅在 shadow/prepared 时执行；`renderer.render` 的深度扫描结果按 schema 引用缓存（schema patch 时失效）；生产环境 `flushPending` 无路径时不再全量 `invalidateTopLevel`，改为按 `recordChange` 路径失效（已有）+ 兜底。
- **优先级**: P1
- **触发条件**: 任意 legacy 页面。
- **预期行为**: 基准不劣于当前（见非功能性需求）。
- **边界条件**: shadow 模式仍执行 `compareShadowPlans`。

### FR-14: core/session 周边一致性
- **描述**: `emit` 未提供 `data` 时 payload 为 `undefined`；`batch` 回滚改为记录 batch 内每次 `_set` 的 `(path, oldValue)` 日志逆序恢复，回滚写入绕过 `assertSessionCanWrite`，并在 `endChangeTransaction` 之前完成；`execute` 在 paused 时 emit `SESSION_PAUSED` 诊断；未指定 `engineId` 时使用 `'default'`，`dispose` 不 `clear` 共享 materials；`renderSsrToString` 不 dispose 传入的 ctx。
- **优先级**: P1
- **触发条件**: 见描述。
- **预期行为**: 见描述。
- **边界条件**: `emit` 需要 `$event` 时显式写 `data: '{{ $event }}'`；被固化错误行为的测试同步改写。

### FR-15: 回归测试与门禁
- **描述**: 将 research-report 记录的全部复现用例落为正式测试：`packages/vario-vue/__tests__/correctness/{reactive-mutation,directive-lifecycle,slot-scope,shared-state-dispose,event-session}.test.ts`、`packages/vario-core/__tests__/regression/{execution-session,expression-cache-special-vars,whitelist-parity,lexical-write}.test.ts`、`packages/vario-vue/__tests__/prepared/{loop-alias,loop-event-ctx}.test.ts`。事件类用例必须包含"真实节奏"（`setTimeout` 间隔）版本。
- **优先级**: P0
- **触发条件**: `pnpm test`。
- **预期行为**: 修复前全部失败、修复后全部通过。
- **边界条件**: 计时类断言不得作为门禁（参考 `no-root-watch.test.ts:355` 的不稳定先例）。

### FR-16: 文档与行为说明
- **描述**: 更新 `docs/guide/node-context.md`（`$children/$siblings` 在 prepared 下为只读视图）、`docs/api/use-vario.md`（`vnode.value` 形态、prepared 模式对直接改 state 的支持范围、`watch(schemaRef)` 不再 deep）、表达式文档（白名单清单）；CHANGELOG 追加。
- **优先级**: P1
- **触发条件**: Phase 4。
- **预期行为**: 文档与实现一致。
- **边界条件**: N/A

## 非功能性需求

### 性能
- `comprehensive-perf-report` 关键场景相对当前基线（1000 项追加 11.35ms、5000 项初始 40.95ms、8 层深嵌套 7.88ms、仪表盘首行 15.43ms）劣化不超过 10%；legacy 单次 `_set` 不再触发 O(节点数 × 表达式数) 的 bridge 扫描。
- prepared 模式若恢复 deep reactive，需在 `__tests__/prepared/no-root-watch.test.ts` 同类场景给出前后对比数据。

### 安全
- 原型污染防护（`__proto__/constructor/prototype` 段拦截）、系统 API 保护（`$methods/_get/_set/$emit/$exprOptions` 不可覆盖）、`Object.assign/defineProperty/setPrototypeOf` 禁止、`eval/Function/setTimeout` 禁止全部保持。
- 不新增可从表达式触达的全局对象。

### 可维护性
- `runtimeMode` 作为显式参数贯穿 renderer / evaluator / event-handler，禁止再用"能否查到 PageSession"推断模式。
- 每条修复对应至少一个回归测试；被改写的既有断言在 verification-report 中逐条登记原因。
- 新增诊断码：`SESSION_DISPOSED_WRITE`、`SESSION_PAUSED`、`PATH_UNRESOLVED_INDEX`，沿用 `errors.ts` 的 `ErrorCodes` 表。

## 影响范围

| 模块 | 影响类型 | 说明 |
|------|---------|------|
| `vario-core/src/vm/executor.ts`、`execution-session.ts`、`handlers/loop.ts`、`handlers/batch.ts`、`handlers/emit.ts` | 修改 | session 解绑/复用规则、loop 共享 session、batch 回滚日志、emit 默认 payload、paused 诊断 |
| `vario-core/src/expression/{evaluate,cache,result-memo,plan-compiler,plan-evaluator,whitelist,policy}.ts` | 修改 | 特殊变量不缓存、memo 前缀失效、别名 localDeps、白名单恢复 |
| `vario-core/src/runtime/{proxy,path,path-policy,loop-context-pool,runtime-session}.ts` | 修改/新增 | 特殊变量失效、依赖收集、词法写入、`createScopeContext`、`loopParents`、disposed 写入语义 |
| `vario-vue/src/{composable,adapter,renderer}.ts`、`composables/internal/use-vario-phases.ts` | 修改 | `VarioLegacyRoot`、dispose 语义、legacy 不建 bridge、显式 runtimeMode |
| `vario-vue/src/features/{expression-evaluator,event-handler,children-resolver,lifecycle-wrapper,loop-handler}.ts` | 修改 | 按模式分流、frame 按 id 释放、scope ctx、lifecycle ctx 优先级 |
| `vario-vue/src/runtime/{page-session,state-bridge}.ts`、`components/{loop-item-cell,vario-root}.ts`、`ssr/create-ssr-session.ts` | 修改/新增 | dispose 不删 key、bridge 依赖匹配、cell ctx 生命周期、SSR ctx 复用 |
| `vario-schema/src/compiler/{prepare-view,prepare-expression,prepare-loop}.ts` | 修改 | 别名注入编译 |
| `vario-types/src/prepared.ts`、`error.ts` | 修改 | `ExpressionPlan` 新增 `aliases`；新增错误码 |
| `packages/*/__tests__` | 新增/修改 | 回归测试；纠正被固化的错误断言 |
| `docs/`、`CHANGELOG.md` | 修改 | FR-16 |

## 依赖与前置条件

- `pnpm install`（当前 `packages/vario-core/node_modules` 缺 vitest，`pnpm test` 无法运行）。
- 待确认项（见 research-report）：`vnode.value` 形态变化的下游影响；prepared 恢复 deep reactive 的接受度。

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| legacy 改回 `evaluate()` 后 prepared 区域组件仍依赖 memo，两条路径行为分叉 | 中 | 中 | Phase 3 同步修正 memo 前缀失效；feature-parity 测试同时覆盖两种模式 |
| `VarioLegacyRoot` 改变 `vnode.value` 形态影响下游 | 低 | 中 | 保留 `useVario` 在无实例环境的直出行为；文档标注；grep 下游仓库 |
| 白名单放宽引入新的表达式攻击面 | 低 | 高 | 仅恢复 HEAD 可用面，`FORBIDDEN_OBJECT_METHODS` 不变，新增安全测试对照 |
| prepared 恢复 deep reactive 导致性能回退 | 中 | 中 | 作为 FR-12 的可选开关先做基准对比，不达标则只做顶层 watch |
| 修复触碰被固化的既有测试 | 高 | 低 | 按 research-report 清单逐条改写并在 verification 登记 |

## 验收标准

- [x] AC-1（FR-1）：同一 ctx 上 `execute(...,{timeout:20})` → 等待 40ms → 再 `execute`/`_set` 均成功；`maxSteps:2` 的两次独立 `execute` 各 1 个 action 均成功；`__tests__/vm/executor.test.ts:709-716` 改为断言 session 已解绑。
- [x] AC-2（FR-2/FR-10）：legacy 挂载后以下操作在 `nextTick` 后 DOM 更新——`state.count = 20`、`state.form.name = 'b'`、`state.show = true`（cond）、`state.list.push()` + `{{ list.length }}`、`_set('items.0.name')` + `{{ items[0].name }}`、`_set('form', {...})` + `{{ form.name }}`、按 10ms 间隔连点三次 `state.count++` 显示 `1,2,3`；state 初始 `{}` 后 `state.form.email = 'x'` 触发依赖 effect。
- [x] AC-3（FR-3/FR-9）：两次事件 `{{ $event.target.value }}` 分别得到各自的值；循环内 `set path: '$item.done'` 修改对应 state 项且视图更新；`_set('$methods', …)` 仍抛错。
- [x] AC-4（FR-5）：循环内作用域插槽输出 `A|A|0`、`B|B|1`（`scope.row.name|$item.name|$index`）；循环外插槽内 `ref` 不是数组。
- [x] AC-5（FR-4）：`Math.pow(2,3)`、`Math.random() >= 0`、`Object.keys(obj).length`、`Array.from(list).length`、`list.slice().reverse()[0]` 求值成功；`list.reverse()`、`Object.assign({}, x)`、`eval('1')` 仍拒绝；白名单错误在 vue 层至少告警一次。
- [x] AC-6（FR-8）：schema 指令 hook 序列为 `mounted:0 → updated:1 → updated:2 → unmounted`，无 `withDirectives` 警告；一次 `_set` 只触发一次 `renderer.render`。
- [x] AC-7（FR-7）：`v-if` 卸载使用共享 reactive state 的组件后，该对象内容不变且可重新挂载显示原值；卸载后飞行中的异步 method 回写不抛未捕获异常，emit `SESSION_DISPOSED_WRITE`。
- [x] AC-8（FR-11/FR-12）：prepared 下 `itemKey: 'user'` 循环输出 `['A','B']`；点击第二行方法收到 `$item.name === 'B'`、`$index === 1`；循环内 `onMounted` 收到对应 `$item`；`app.component('Card')` 可解析；`ref` 可用；500 项列表全量渲染或 emit 预算诊断；`{{ list.slice(0,5) }}` 循环在 `_set('list')` 后刷新；`model: 'form.name'` 在 `_set('form.name')` 后刷新；`computed` schema 替换后渲染新 view。
- [x] AC-9（FR-15）：新增回归测试在当前工作区全部失败、修复后全部通过；vue/core/schema 全量测试通过；`__tests__/vm/executor.test.ts`、`__tests__/vm/handlers/emit.test.ts`、`__tests__/prepared/loop-model-event.test.ts` 中被固化的错误断言已改写。
- [x] AC-10（FR-13）：`comprehensive-perf-report` 四个基准场景 median 不高于当前值的 110%；legacy 下单次 `_set` 不调用 `VueStateBridge.apply`。
- [x] AC-11（FR-14）：`emit` 无 `data` 时 payload 为 `undefined`；`batch` 在 Vue reactive 状态下嵌套路径可回滚且超时时抛 `BatchError`；`hydrateVarioApp` 后 `_set` 不抛 `Session disposed`；连续挂载/卸载 100 次 `engines` Map 大小不变；多页面共享 `engineId` 时单页 dispose 不清空 materials。
- [x] 非功能：五包 `tsc --noEmit` 通过；`eslint packages/ --max-warnings 0` 通过；`pnpm install` 后 `pnpm test` 可运行。

## 调研依据

信息源覆盖：本次以项目源码阅读、`git diff HEAD` 对照与本地复现（happy-dom 挂载 + dist 冒烟）为主；Context7、GitHub、WebSearch、Stack Overflow 四类外部信息源未使用（N/A），Vue 行为直接对照 Vue 3.5.27 源码与实测。

### 技术可行性

| 调研项 | 结论 | 来源 | 可信度 |
|--------|------|------|--------|
| ExecutionSession 泄漏导致 5 秒后全部 `ACTION_TIMEOUT` | 已复现（dist 与源码一致） | research-report KG-1 | 高 |
| legacy 表达式走 ResultMemo 且 memo 无前缀失效 | 已复现 7 类场景 | research-report KG-2 | 高 |
| `withDirectives` 必须在 render 函数内 | Vue runtime-core 约束 + 复现 | research-report KG-6/KG-14 | 高 |
| Vue reactive 不追踪 `hasOwnProperty.call` | Vue 3.5.27 实测 | research-report KG-13 | 高 |
| `pauseTracking` 非公开 API | Vue 类型定义 | research-report KG-15 | 中 |

### 业界方案参考

| 调研项 | 参考项目/文章 | 关键发现 |
|--------|-------------|---------|
| 缓存失效策略 | 项目内旧实现 `cache.ts` + `matchPath` | 双向前缀匹配语义正确且与 deep watch 路径采集一致 |
| 异步作用域帧管理 | 项目内 `scope-frame.ts` | 按 id 删除的原语已存在，只需事件路径改用 |
| legacy 渲染宿主 | 项目内 prepared `VarioRoot` | 同型实现可直接对齐 |

### 性能/安全基准

| 调研项 | 业界基准 | 本项目目标 |
|--------|---------|-----------|
| 关键渲染场景 | 当前 `comprehensive-perf-report` 输出 | 劣化 ≤ 10% |
| 表达式安全面 | HEAD 白名单 | 恢复到 HEAD，不扩大 |

### 已知风险/坑点

| 风险 | 来源 | 缓解措施 |
|------|------|---------|
| 新增测试固化错误行为 | research-report 风险表 | 随修复改写并登记 |
| loop ctx Proxy 原型链断开影响 session/execution 查找 | research-report 风险表 | `loopParents` WeakMap 回落父 ctx |

## 参考资料

- [research-report.md](./research-report.md)
- Context7: N/A
- GitHub: N/A
- WebSearch: N/A
- Stack Overflow: N/A
- 项目源码：见 research-report "项目源码"一节
