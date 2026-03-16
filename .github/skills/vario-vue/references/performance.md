# Performance Optimization — Deep Reference

> 读取时机：用户需要理解渲染性能机制、调试重渲染问题时读取。

## Table of Contents
1. [Scope-Weight Hybrid 策略](#scope-weight-hybrid-策略)
2. [基准测试数据](#基准测试数据)
3. [path-memo（路径缓存）](#path-memo)
4. [子树组件化](#子树组件化)
5. [循环组件化](#循环组件化)
6. [SchemaStore（Schema 碎片化）](#schemastore)

---

## Scope-Weight Hybrid 策略

所有性能优化**零配置自动生效**。渲染器内部基于 Scope-Weight Hybrid 策略自适应管理：

- **path-memo**：始终开启，缓存静态子树 VNode
- **子树组件化**：`isScopeBoundary(node) && computeWeight(node) > COMPONENT_OVERHEAD(5)` 时自动拆分
- **循环组件化**：`computeLoopTemplateWeight(template) > COMPONENT_OVERHEAD(5)` 时自动包装

`COMPONENT_OVERHEAD = 5` — 组件化的入场门槛（Vue 组件 setup/proxy/VNode diff 的固定成本）。

`UseVarioOptions` 中不再有 `rendererOptions` 字段。`directives` 已提升为 `UseVarioOptions` 的顶级选项。

> **插件系统对性能无负面影响**：将 lifecycle/transition/keepAlive/teleport 抽离为 VNodePlugin 后，非相关节点跳过了不必要的特性检查，部分场景反而略有改善。

---

## 基准测试数据

> 测试环境：Node.js + Vitest + Vue 3，测试日期 2026-03-15

### 核心场景基准

| 场景 | 基线 | path-memo | loop组件化 | 组合优化 |
|------|------|-----------|-----------|----------|
| 1000节点渲染 | 40.27ms | 22.15ms **(1.82x)** | — | — |
| 500循环渲染 | 50.47ms | 23.45ms (2.15x) | 21.78ms (2.32x) | **6.31ms (7.99x)** |
| 单项更新×50 | 8201ms | 6617ms (1.24x) | 6636ms (1.24x) | **5194ms (1.58x)** |
| 频繁更新×100 | 5.18ms | **2.23ms (2.33x)** | — | — |
| 嵌套循环 20×20 | 5.98ms | **3.49ms (1.72x)** | 4.22ms (1.42x) | 3.93ms (1.52x) |

### Element Plus 场景

| 场景 | 基线 | path-memo | loop组件化 | 组合优化 |
|------|------|-----------|-----------|----------|
| ElForm 50字段 | 0.38ms | **0.18ms (2.18x)** | — | — |
| ElTable 200行 | 0.95ms | **0.73ms (1.29x)** | — | — |
| ElButton+Tag 300项 | 21.51ms | 14.30ms (1.50x) | 14.07ms (1.53x) | **13.16ms (1.63x)** |

### 优化对比专项

| 策略 | 场景 | 加速比 |
|------|------|--------|
| **path-memo** | 500节点初始化 | **3.43x** |
| **path-memo** | 200静态节点×10重渲染 | **19.42x** |
| **loopItemAsComponent** | 500项列表初始化 | **1.57x** |
| **loopItemAsComponent** | 200项×50单项更新 | **1.25x** |
| **组合** | 复杂表单+100项×30更新 | **1.16x** |
| **组合** | 20×20嵌套循环×20更新 | **1.11x** |

### 汇总

- **path-memo**: 平均 **11.43x** 加速（静态子树重渲染场景表现突出）
- **loopItemAsComponent**: 平均 **1.41x** 加速
- **组合优化**: 平均 **1.13x** 加速

---

## path-memo

源码：`packages/vario-vue/src/features/path-memo.ts`

按 schema 节点路径缓存 VNode，未变化的分支直接复用缓存，跳过整棵子树的递归渲染。始终开启。

### 缓存 key 结构
```
key = path | schemaId | depsKey

path      = "root.0.1"（节点在树中的路径）
schemaId  = type|cond|show|loop|childrenLen  // 结构标识（不含求值结果）
depsKey   = condValue|showValue              // 依赖值（求值结果）
```

### canMemo 条件（全部为 true 才缓存）
```
canMemo = !schema.loop                   // 非循环节点
       && !isLoopItem                    // 非循环子项（path 不含 [）
       && !hasLoopInSubtree(schema)      // 子树无循环
       && !hasModelInSubtree(schema)     // 子树无 model 绑定
       && !hasExpressionInSubtree(schema) // 子树无表达式引用
```

### 为什么排除这些节点
| 排除条件 | 原因 |
|----------|------|
| loop 节点 | 数据源变化时需重新展开循环 |
| isLoopItem | 循环上下文含动态变量，缓存不安全 |
| model 绑定 | 依赖 state 生成 value/onUpdate，缓存返回旧绑定 |
| 表达式引用 | props/children/events 中的 `{{ }}` 或 `${}` 依赖 state |

### 子树检查函数

所有子树检查函数均使用**模块级 WeakMap 缓存**（`_loopCache`、`_modelCache`、`_exprCache`），首次递归后结果缓存在 `WeakMap<SchemaNode, boolean>` 中，后续调用 O(1) 命中。Schema 对象被 GC 后缓存自动释放。

**hasLoopInSubtree(schema)**：递归检查自身及所有子节点是否有 `loop` 属性。

**hasModelInSubtree(schema)**：检查 `model`（string 或 object.path 且非 scope）和 `model:xxx` 命名绑定。

**hasExpressionInSubtree(schema)**：
- `props` — 递归检查所有值是否含 `{{` 或 `${`
- `children`（string）— 文本插值
- `events` — 事件参数中的表达式
- 不检查 `cond`/`show`（它们的值已在 `depsKey` 中，变化自动失效）

**buildSchemaId(schema)** 同样使用 `_schemaIdCache: WeakMap<SchemaNode, string>` 缓存结构标识字符串。

### PathMemoCache API
```typescript
class PathMemoCache {
  static readonly MAX_SIZE = 5000  // 防止无限增长
  get(key: string): VNode | undefined
  set(key: string, vnode: VNode): void  // 超过 MAX_SIZE 时自动 clear()
  clear(): void   // schema 结构大变时调用
}
```

> 同样，`@variojs/core` 中的 `compiledCache`（表达式编译缓存，MAX=2000）和 `pathCache`（路径解析缓存，MAX=2000）也有溢出清理机制。

### 在渲染流程中的位置
```
cond 求值 → show 求值→ canMemo 检查 → cache.get → 命中直接返回
                                      ↓ 未命中
                        正常渲染 → 结果存入 cache.set
```

---

## 循环组件化

源码：`packages/vario-vue/src/features/loop-handler.ts`

当循环模板的权重 > COMPONENT_OVERHEAD (5) 时，自动将每个循环项包装为独立 `LoopItemCell` 组件，利用 Vue 的组件级别 diff — 单项数据变化只重渲染该项。

### 决策逻辑
```
computeLoopTemplateWeight(template) > COMPONENT_OVERHEAD → LoopItemCell
otherwise → 直接 createVNode
```

### 实现原理
当模板权重大于阈值时，LoopHandler 中每个循环项不再直接调用 `createVNode`，而是：
```typescript
h(LoopItemCell, {
  key,
  schema: childSchema,
  ctx: loopCtx,
  path: childPath,
  modelPathStack: loopPathStack,
  renderNode: stableRenderFn  // WeakMap 缓存的稳定渲染函数
})
```

`LoopItemCell` 是一个轻量 `defineComponent`，其 render 函数仅调用 `renderNode(schema, ctx, ...)`。Vue 在 patch 时对 props 未变的组件可跳过 re-render。

### 适用场景
- 大列表（>50 项）
- 循环项内部结构复杂
- 列表数据频繁局部更新

---

## 子树组件化

源码：`packages/vario-vue/src/features/vario-node.ts`, `packages/vario-vue/src/features/schema-weight.ts`

将 schema 树中满足条件的节点包装为独立 `VarioNode` Vue 组件，Vue 自动跳过 props 未变的组件，实现细粒度局部更新。

### shouldComponentize 判定逻辑（Scope-Weight Hybrid）
```
schema.loop → 不组件化（loop 必须在 renderer 层处理）
!isScopeBoundary(schema) → 不组件化

isScopeBoundary 条件（任一为 true）：
  - 有 model 绑定
  - 首字母大写的组件名（/^[A-Z]/）
  - 有生命周期钩子（onMounted 等）
  - 有 provide/inject

computeWeight(schema) <= COMPONENT_OVERHEAD (5) → 不组件化
computeWeight(schema) > COMPONENT_OVERHEAD (5) → 组件化
```

特殊规则：有 lifecycle/provide/inject 的节点**始终组件化**（需要独立 setup 环境），不检查权重。

### VarioNode 组件内部
- `computed` 缓存 cond/show/component/modelPathStack 求值结果
- render 函数镜像 renderer 管线：cond → show style → buildAttrs → resolveChildren → lifecycle wrap → ref → keepAlive → transition
- loop 安全回退：即使到达 VarioNode，检测到 loop 也返回 null

### 粒度说明
子树组件化由 Scope-Weight Hybrid 策略自动决定，无需手动配置粒度。scope boundary + weight > threshold 的节点自动组件化。

---

## SchemaStore

源码：`packages/vario-vue/src/features/schema-store.ts`（**内部模块，不公开导出**）

将整棵 schema 树拆分为 `path → reactive(node)` 的扁平映射，修改某路径的节点只触发依赖该路径的 effect。SchemaStore 由渲染器内部管理，通过 Schema Query API 间接使用。

### SchemaStore API
```typescript
interface SchemaStore {
  get(path: string): SchemaNode | undefined
  set(path: string, node: SchemaNode): void
  delete(path: string): void         // 递归删除子节点
  has(path: string): boolean
  keys(): string[]
  clear(): void
  getRoot(): SchemaNode | undefined
  fromTree(schema: SchemaNode): void  // 从完整树初始化
  toTree(): SchemaNode | undefined    // 还原为完整树
  patch(path: string, partial: Partial<SchemaNode>): void  // 精确更新
  getChildPaths(path: string): string[]
  getVersion(path: string): number    // 变更检测
  trigger(path: string): void         // 手动触发
}
```

### 内部实现
- `nodes`: `shallowReactive(Map<string, SchemaNode>)` — 每个节点独立浅响应式
- `versions`: `shallowReactive(Map<string, number>)` — 版本号用于精确失效
- `childPathsCache`: 子路径缓存用于树重建
- `walkTree()`: 递归遍历 schema 树，用 `joinPath(parent, index)` 生成路径

### 路径工具函数
```typescript
joinPath('root', 0)      → 'root.0'
getParentPath('root.0')  → 'root'
getLastSegment('root.0') → '0'
```

---

## 零配置使用

所有优化由渲染器自适应管理，用户直接使用 `useVario` 即可：

```typescript
const { vnode, state } = useVario(schema, {
  state: { /* ... */ },
  components: { ElButton, ElInput },
  // 无需 rendererOptions — 所有优化自动生效
})
```

### 注意事项
- path-memo 缓存静态子树，Scope-Weight 处理动态子树，两者互补
- 循环组件化和子树组件化均基于 weight > COMPONENT_OVERHEAD 自动决策
- SchemaStore、VarioNode、schema-weight 均为内部模块（不在 `@variojs/vue` 公共导出中），通过 Schema Query API 间接使用
- 所有方案对用户 Schema 写法透明，无需修改 Schema
- 所有包均声明 `"sideEffects": false`，支持打包器 tree-shaking
- 全局缓存均有大小限制（PathMemoCache 5000、compiledCache 2000、pathCache 2000），防止长期运行内存泄漏
