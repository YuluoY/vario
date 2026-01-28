# @vario/schema 最佳实践

## 1. 用类型约束整棵树

- 使用 **SchemaNode** 或 **VueSchemaNode**（@vario/vue）给变量、入参、返回值标注类型，避免手写 any。
- 若有明确状态形状，用 **SchemaNode\<TState\>** 或 **Schema\<TState\>**，便于和 useVario / defineSchema 的泛型一致。

## 2. 先校验再渲染或持久化

- 对来自网络、配置或协作编辑的 Schema，先 **validateSchema**，再 **normalizeSchema**，再交给渲染或存库。
- 开发阶段可用 **validateSchemaWithResult** 在控制台或 UI 里列出所有错误，方便一次修完。

## 3. 表达式与路径

- 表达式只写“读状态 + 白名单函数”，复杂逻辑用 **call** 调 methods 或 services。
- 路径尽量明确：能用 `model: 'form.user.name'` 就不依赖隐式栈；循环内用 `model: { path: 'list', scope: true }` 再在子节点用扁平路径，语义更清晰。

## 4. defineSchema 的适用场景

- 状态和服务由同一处定义、且希望“一份配置出类型 + Schema”时，用 **defineSchema**。
- 从 view 上拿 **view.schema** 给 useVario，用 **InferStateType\<typeof view\>** 作为 state 类型，保证类型和运行时一致。

## 5. 规范化与缓存

- 渲染前对“原始 Schema”做一次 **normalizeSchema**，后续 diff、缓存、序列化都基于规范化结果，避免空白和顺序带来的噪声。
- 若 Schema 在运行时不变，规范化结果会因缓存而几乎无额外开销；若经常替换整棵树，可酌情在少数节点上做 normalize，不必每次都全树规范化。

## 6. 自定义校验

- 用 **ValidationOptions.customValidators** 加业务规则：禁止某些 type、限制嵌套深度、强制某些 props 存在等，在 CI 或保存前跑一遍，把问题拦在运行前。
