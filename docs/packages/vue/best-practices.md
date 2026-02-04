# @vario/vue 最佳实践

## 1. 状态与 Schema 一一对应

- state 的结构和 Schema 里 **model**、**{{ }}**、**cond**、**show**、**loop.items** 用到的路径保持一致，避免"路径写了但 state 里没有"或类型对不上。
- 用 **defineSchema** 或 **InferStateType** 从 Schema/view 推导状态类型，再作为 useVario 的 state 类型，减少重复定义。
- **使用 TypeScript 泛型**：`useVario<MyState>(schema, { state })` 获得完整的类型推导。

## 2. model 与路径

- **容器**用 `model: { path: 'form', scope: true }`，不在容器上绑 v-model；**叶子**用 `model: 'fieldName'` 或完整路径。
- 状态未初始化时可用 **默认值**：`model: { path: 'name', default: '张三' }`，会写回状态。
- 可选字段可用 **惰性**：`model: { path: 'optional', lazy: true }`，不预写 state，仅用户修改后写入。
- 整棵 schema 默认惰性：`useVario(schema, { modelOptions: { lazy: true } })`，所有未显式设置 `lazy` 的 model 均不预写 state；节点上可写 `lazy: false` 覆盖。
- **Model 修饰符**：使用 `modifiers: ['trim', 'number', 'lazy']` 简化输入处理，减少手动验证代码。
- 循环用 `model: { path: 'list', scope: true }` + 子节点扁平路径，或循环内需要绑定"当前项本身"时用 `model: '.'`。
- 数组下标尽量用 **[]** 写法（如 `items[0].name`），语义更清晰，也和 Core 路径解析一致。

## 3. 事件与 methods

- 事件里多步操作用 **batch** 或在一个 method 里完成，避免中间态触发多余渲染。
- 把"可复用的业务逻辑"放在 methods，Schema 里只做 **call**；不在表达式里写长逻辑。
- **使用事件修饰符**：在事件名中使用点语法（`click.stop.prevent`）而不是在方法中手动调用。
- **方法支持 async/await**：异步操作直接返回 Promise，Vario 会自动处理。
- **类型安全的方法上下文**：
  ```typescript
  methods: {
    handleClick: ({ ctx, state }: MethodContext<MyState>) => {
      state.count++  // ✅ 类型推导
      ctx.$self?.type  // ✅ 节点上下文类型推导
    }
  }
  ```

## 4. 表达式

- 只写读状态 + 简单运算 + 白名单函数；复杂展示用 **computed** 在组件里算好，再通过 useVario 的 **computed** 选项注入到 Schema 里用 `{{ computedName }}` 引用。
- **避免在表达式中执行副作用**：表达式应该是纯函数，不要修改状态或触发事件。
- **使用表达式选项**：通过 `exprOptions` 配置允许的全局变量和最大深度。

## 5. 节点上下文

- **访问父节点**：在需要访问父节点数据时，使用 `ctx.$parent` 而不是传递额外的 props。
- **链式访问祖先**：使用 `ctx.$parent.$parent` 访问更高层级的节点。
- **兄弟节点通信**：通过 `ctx.$siblings` 访问同层节点，实现字段间联动。
- **树形导航**：利用节点上下文实现面包屑、级联选择等功能。
- **示例**：
  ```typescript
  methods: {
    validateConfirmPassword: ({ ctx, state }) => {
      // 通过兄弟节点访问密码字段
      const passwordField = ctx.$siblings?.find(s => s.model === 'password')
      if (passwordField && state.password !== state.confirmPassword) {
        state.error = '两次密码不一致'
      }
    }
  }
  ```

## 6. 生命周期管理

- **初始化使用 onMounted**：在 `onMounted` 钩子中加载数据、初始化第三方库。
- **清理使用 onUnmounted**：务必在 `onUnmounted` 中清理定时器、取消订阅、释放资源，防止内存泄漏。
- **多节点生命周期**：不同节点可以有独立的生命周期钩子，按需加载不同区块的数据。
- **KeepAlive 支持**：配合 `keepAlive: true` 使用 `onActivated`/`onDeactivated` 管理缓存组件状态。
- **示例**：
  ```typescript
  const schema: VueSchemaNode = {
    type: 'div',
    onMounted: 'loadData',
    onUnmounted: 'cleanup',
    onUpdated: 'syncExternalLibrary'
  }
  
  const methods = {
    async loadData({ state }) {
      state.data = await fetchData()
    },
    cleanup() {
      clearInterval(intervalId)
      ws?.close()
    }
  }
  ```

## 7. 大列表与性能

- 超过几百条的列表优先考虑**虚拟滚动**或分页，而不是一次渲染整棵 Schema 子树。
- 控制嵌套深度（例如 3～4 层以内），过深的树会加重递归与依赖收集。
- 若同一份 Schema 会多次实例化，尽量在"上层"做一次 **normalizeSchema**，再传进 useVario，减少重复计算。
- **使用 Schema 查询的惰性分析**：`useVario` 默认启用惰性分析，只在需要时才解析 Schema。
- **避免频繁的 Schema 更新**：使用状态驱动 UI 变化，而不是频繁修改 Schema 结构。

## 8. 与 defineSchema 配合

- 用 **view.schema** 作为 useVario 的第一个参数，**view 的 state** 作为初始 state，**view 的 services** 映射到 methods（若框架支持），类型用 **InferStateType\<typeof view\>**，保证类型与运行时一致，并便于在测试、文档、低代码平台里复用同一份定义。

## 9. 错误与边界

- 对来自配置或远端的 Schema，在传入 useVario 前做 **validateSchema**，避免运行时在渲染中途抛错。
- 启用 **errorBoundary** 时提供有意义的 fallback，并在 onStateChange / 日志中记录错误，便于排查。
- **错误恢复**：使用 `retry()` 方法手动恢复渲染，配合 `error` Ref 监听错误状态。
- **示例**：
  ```typescript
  const { error, retry } = useVario(schema, {
    errorBoundary: {
      enabled: true,
      fallback: (error) => h('div', '渲染错误: ' + error.message),
      onRecover: (error) => console.error('Error:', error)
    }
  })
  
  watch(error, (err) => {
    if (err) {
      setTimeout(() => retry(), 5000)  // 5秒后自动重试
    }
  })
  ```

## 10. Schema 查询优化

- **使用 ID 查询**：对于频繁访问的节点，设置 `id` 属性并使用 `findById` 进行 O(1) 查找。
- **缓存查询结果**：查询结果会自动缓存，避免重复遍历。
- **批量操作**：使用 `findAll` 一次性查找所有匹配节点，而不是多次调用 `find`。
- **示例**：
  ```typescript
  const { findById, findAll } = useVario(schema)
  
  // ✅ 高效：使用 ID 查询
  const submitBtn = findById('submit-btn')
  submitBtn?.patch({ props: { disabled: true } })
  
  // ✅ 批量操作
  const allInputs = findAll(node => node.type === 'ElInput')
  allInputs.forEach(input => input.patch({ props: { size: 'small' } }))
  ```

## 11. Refs 使用

- **访问组件实例**：通过 `refs` 对象访问组件实例，调用组件方法。
- **在 onMounted 后访问**：ref 在组件挂载后才可用，应在 `onMounted` 或之后访问。
- **类型安全**：使用 TypeScript 时，为 ref 指定正确的组件类型。
- **示例**：
  ```typescript
  const schema: VueSchemaNode = {
    type: 'ElForm',
    ref: 'myForm',
    onMounted: 'initForm'
  }
  
  const { refs } = useVario(schema, {
    methods: {
      initForm() {
        // ✅ 在 onMounted 中访问 ref
        const formRef = refs.myForm.value
        if (formRef) {
          formRef.resetFields()
        }
      },
      async submitForm() {
        const valid = await refs.myForm.value?.validate()
        if (valid) {
          // 提交表单
        }
      }
    }
  })
  ```

## 12. 非组件上下文使用

- **在 Pinia store 中使用**：传递 `app` 实例或 `components` 映射。
- **在测试中使用**：提供必要的组件依赖。
- **示例**：
  ```typescript
  import { createApp } from 'vue'
  import ElementPlus from 'element-plus'
  
  const app = createApp({})
  app.use(ElementPlus)
  
  // 方式 1：传递 app
  const { vnode } = useVario(schema, { app })
  
  // 方式 2：直接传递组件
  const { vnode } = useVario(schema, {
    components: { ElButton, ElInput }
  })
  ```

## 13. 可维护性

- 大 Schema 按"区块"拆成多个对象或函数，用 **children** 组合；或使用 defineSchema 的 schema 函数按 ctx 状态分支返回不同子树。
- 组件名（type）与项目内组件注册名、文档保持一致，方便搜索和重构。
- **提取可复用的 Schema 片段**：将常用的 Schema 模式提取为函数或常量。
- **使用有意义的 ID**：为重要节点设置语义化的 ID，便于查询和调试。
- **文档化复杂逻辑**：为复杂的表达式、方法添加注释说明。

## 14. 类型安全最佳实践

- **定义清晰的状态接口**：
  ```typescript
  interface FormState {
    username: string
    email: string
    age: number
    items: Array<{ id: string; name: string }>
  }
  
  const { state, ctx } = useVario<FormState>(schema, {
    state: { username: '', email: '', age: 0, items: [] }
  })
  ```

- **使用类型推导**：充分利用 TypeScript 的类型推导能力，减少显式类型注解。

- **节点上下文类型**：`RuntimeContext<TState>` 会自动推导节点属性的状态类型。

- **Action 类型安全**：使用 Action 的智能类型推导，IDE 会提示必需属性。

## 相关文档

- [useVario API](/api/use-vario) - 完整的 API 参考
- [生命周期](/packages/vue/lifecycle) - 生命周期钩子详解
- [节点上下文](/guide/node-context) - 节点关系访问
- [Schema 查询](/guide/schema-query) - 查询和操作 Schema
- [类型定义](/packages/vue/types) - 完整的类型系统
- [Refs 文档](/packages/vue/refs) - 模板引用使用指南
