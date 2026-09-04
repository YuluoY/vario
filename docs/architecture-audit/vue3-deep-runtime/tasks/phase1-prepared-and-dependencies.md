# Phase 1：PreparedView、ExpressionPlan 与依赖版本

> 状态：已完成 | 任务：9 | 净工时：34h  
> 方案：[../plans/02-prepared-expression.md](../plans/02-prepared-expression.md)

## 任务

- [x] **T1.1**: 定义只读 Prepared 与 diagnostic 类型合同
  - **描述**：新增 `PreparedView/PreparedNode/PreparedRegion/ExpressionPlan/RuntimeBudget/VarioDiagnostic`，只表达框架无关计划。
  - **产出物**：`packages/vario-types/src/prepared.ts`、`packages/vario-types/src/index.ts`
  - **参考**：`packages/vario-types/src/schema.ts`、`packages/vario-types/src/runtime.ts`、`packages/vario-types/src/expression.ts`
  - **复用**：现有 readonly/type export 风格和 public type snapshot。
  - **验收**：types 包不引入 Vue；计划字段全 readonly；新增导出为 additive，现有类型 snapshot 无删除。
  - **预估**：3h
  - **依赖**：T0.8

- [x] **T1.2**: 实现显式栈 Schema 遍历器
  - **描述**：用 work stack 替代 prepare 热路径递归，支持顺序、cycle、maxDepth、maxNodes 和主动中止。
  - **产出物**：`packages/vario-schema/src/compiler/traverse-iterative.ts`、`packages/vario-schema/__tests__/compiler/traverse-iterative.test.ts`
  - **参考**：`packages/vario-core/src/runtime/traversal.ts`、`packages/vario-core/src/schema/analyzer.ts`
  - **复用**：现有 Schema children 判定、validator error 类型和 T0 deep fixture。
  - **验收**：10,000 层不栈溢出；访问顺序确定；cycle/depth/node budget 在分配下一节点前受控中止。
  - **预估**：4h
  - **依赖**：T1.1

- [x] **T1.3**: 单次构建 ID/parent/children/path/depth 索引
  - **描述**：在遍历过程中一次建立扁平索引，移除运行时 sibling 重扫所需的信息缺口。
  - **产出物**：`packages/vario-schema/src/compiler/prepare-index.ts`、`packages/vario-schema/__tests__/compiler/prepare-index.test.ts`
  - **参考**：`packages/vario-vue/src/features/node-context.ts`、`packages/vario-vue/src/features/schema-analyzer.ts`、`renderer.ts#registerParentMap`
  - **复用**：stable node ID、diagnostic 和 T0 operation counter。
  - **验收**：index 写次数 `≤3N`；duplicate ID 阻断；root/first-match/children order 语义有断言；path 延迟物化。
  - **预估**：4h
  - **依赖**：T1.2

- [x] **T1.4**: 实现静态、动态、loop、slot 与语义区域分类
  - **描述**：依据 feature/dependency flags 生成 maximal StaticRegion 和保守 Dynamic/Semantic regions。
  - **产出物**：`packages/vario-schema/src/compiler/prepare-node.ts`、`packages/vario-schema/__tests__/compiler/prepare-node.test.ts`
  - **参考**：`packages/vario-vue/src/features/schema-weight.ts`、`packages/vario-vue/src/features/vario-node.ts#shouldComponentize`
  - **复用**：现有 feature detection、Schema normalization 与 T0 feature fixtures。
  - **验收**：静态链形成最大静态区；动态/lifecycle/ref/directive/loop/slot 必成边界；分类不按每节点或单一后代阈值。
  - **预估**：4h
  - **依赖**：T1.1、T1.2

- [x] **T1.5**: 编译 ExpressionPlan 与 state/local dependency
  - **描述**：在现有 parser/AST policy 上生成 plan ID、state/local/dynamic deps、purity、cost 与 policy fingerprint。
  - **产出物**：`packages/vario-core/src/expression/plan.ts`、`packages/vario-core/src/expression/plan-compiler.ts`、`packages/vario-core/__tests__/expression/plan.test.ts`
  - **参考**：`packages/vario-core/src/expression/parser.ts`、`dependencies.ts`、`compiler.ts`、`whitelist.ts`
  - **复用**：现有 parser、AST validator、dependency extractor 和 security policy。
  - **验收**：plan key 含 grammar+policy；区分 state/local/dynamic deps；pure/cost 可断言；输出 frozen；不放宽表达式安全策略。
  - **预估**：4h
  - **依赖**：T1.1

- [x] **T1.6**: 实现 O(1) Plan LRU 与 Session 依赖版本 memo
  - **描述**：分离可共享 immutable plan cache 和不可跨 Session 的 result memo，以 dependency versions 判断有效性。
  - **产出物**：`packages/vario-core/src/expression/plan-cache.ts`、`packages/vario-core/src/expression/result-memo.ts`、`packages/vario-core/__tests__/expression/result-memo.test.ts`
  - **参考**：`packages/vario-core/src/expression/cache.ts`
  - **复用**：Map 插入顺序、现有 cache stats 与 T0 expression counter。
  - **验收**：null/undefined/false/0 均可命中；99/100/101 无全清 cliff；500/2000 有界；不同 policy/Session/scope generation 不串结果。
  - **预估**：4h
  - **依赖**：T1.5

- [x] **T1.7**: 编排 prepareView 并编译渲染字段计划
  - **描述**：组合 traversal/index/region/expression，预编译 props/text/model/event/loop/slot/path，发布完整或失败结果。
  - **产出物**：`packages/vario-schema/src/compiler/prepare-view.ts`、`packages/vario-schema/src/compiler/index.ts`、`packages/vario-schema/__tests__/compiler/prepare-view.test.ts`
  - **参考**：`packages/vario-vue/src/features/attrs-builder.ts`、`children-resolver.ts`、`event-handler.ts`、`path-resolver.ts`
  - **复用**：现有 normalize/extractExpression/path parser 与 T1.2～T1.5。
  - **验收**：render 热路径无需 schema clone、递归结构扫描、path parse 或 expression parse；失败不发布半成品；golden 顺序/语义一致。
  - **预估**：4h
  - **依赖**：T1.3、T1.4、T1.5

- [x] **T1.8**: 接入 useVario shadow prepare 且保持公共行为
  - **描述**：新增 legacy/shadow/prepared 内部 mode 基础设施；shadow 只 prepare/compare，不输出 DOM 或执行副作用。
  - **产出物**：`packages/vario-vue/src/runtime/runtime-mode.ts`、`packages/vario-vue/src/runtime/legacy-prepared-adapter.ts`、`packages/vario-vue/src/composable.ts`
  - **参考**：`packages/vario-vue/src/composable.ts`、`packages/vario-vue/src/composables/internal/use-vario-phases.ts`
  - **复用**：现有 `useVario` Facade、error/stats/query 返回和 T0 API baseline。
  - **验收**：调用代码不变；legacy/shadow DOM、emit、refs、error、stats/query 等价；shadow 不执行 action/lifecycle/service 两次。
  - **预估**：4h
  - **依赖**：T1.6、T1.7

- [x] **T1.9**: 执行 Prepared/Expression 算法门禁并保存 baseline
  - **描述**：固化 10,000 深树、1000 节点 index、99/100/101/500/2000 expression cache 与 shadow parity 结果。
  - **产出物**：`packages/vario-schema/__tests__/compiler/prepare-performance.test.ts`、`packages/vario-core/__tests__/expression/plan-performance.test.ts`、`benchmarks/vue-depth/baseline/prepared.json`
  - **参考**：`docs/architecture-audit/acceptance-gates.md` 的 PERF-A1/A4/A6、专项 AC-01/AC-10。
  - **复用**：T0 runner/hooks、T1.6 cache stats 和 T1.8 shadow adapter。
  - **验收**：operation counts 与正确性门禁全绿；原始 JSON 含环境/commit；compiler 10,000 层成功不被写成 DOM 支持声明。
  - **预估**：3h
  - **依赖**：T1.6、T1.7、T1.8

## 阶段出口

- [x] Immutable PreparedView、ExpressionPlan 和 dependency-version memo 完整。
- [x] Shadow prepare 不改变 public API、DOM 或业务副作用。
- [x] 根 deep watch 仍保留，prepared renderer 尚未默认输出。

