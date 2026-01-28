# 状态管理

`useVario` 会自动将传入的 `state` 包裹为 Vue 的响应式对象（`reactive`），并建立与运行时上下文（`RuntimeContext`）的双向同步。

```typescript
const { state, ctx } = useVario(schema, {
  state: {
    user: {
      name: 'John',
      age: 30
    }
  }
})

// state 是响应式的
state.user.name = 'Jane'  // ✅ Vue 会自动追踪变化

// 也可以通过 ctx 访问
ctx._get('user.name')  // 'Jane'
ctx._set('user.age', 31)  // ✅ 会同步到 state.user.age
```

## Model 双向绑定与依赖收集

**关键特性：会根据层级自动收集依赖**

当你在 Schema 中使用 `model` 双向绑定时，Vario 会：

1. **自动追踪嵌套路径**：使用 Vue 的 Proxy 响应式系统追踪深层属性访问
2. **双向同步**：`ctx._set` 的变化会通过 `onStateChange` 同步到 `reactiveState`
3. **层级依赖收集**：Vue 会自动追踪所有访问的嵌套路径

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'input',
      model: 'user.profile.name',  // 深层路径
      props: { placeholder: '姓名' }
    },
    {
      type: 'input',
      model: 'user.profile.email',
      props: { placeholder: '邮箱' }
    },
    {
      type: 'div',
      children: '{{ user.profile.name }} - {{ user.profile.email }}'
    }
  ]
}

const { state } = useVario(schema, {
  state: {
    user: {
      profile: {
        name: '',
        email: ''
      }
    }
  }
})
```

当用户在输入框中输入时：触发 `update:modelValue` → `ctx._set(...)` → `onStateChange` → 通过 `setPathValue` 更新 `reactiveState`，Vue 会更新所有依赖该路径的组件。

路径写法与自动创建结构的规则见 [Model 与路径](/guide/model-path)。
