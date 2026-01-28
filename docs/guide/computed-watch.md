# Computed 与 Watch

**重要**：`computed` 和 `watch` **不在 Schema 中定义**，应在 Vue 组件中用原生 API 定义。

## Computed 计算属性

```typescript
import { computed } from 'vue'

const state = reactive({
  firstName: 'John',
  lastName: 'Doe'
})

const fullName = computed(() => state.firstName + ' ' + state.lastName)

const { vnode } = useVario(schema, {
  state,
  computed: { fullName }  // 传入 Vue ComputedRef
})
```

Schema 里用 `{{ fullName }}` 即可。

## Watch 监听器

```typescript
import { watch } from 'vue'

watch(() => state.count, (newVal, oldVal) => {
  console.log('Count changed:', newVal, '->', oldVal)
})

watch(() => state.user.name, (newVal) => {
  console.log('User name changed:', newVal)
}, { immediate: true, deep: true })

const { vnode } = useVario(schema, { state })
```

## 为什么不在 Schema 中定义？

- 避免重新实现 Vue 的响应式系统
- 利用 Vue 的编译优化
- 保持与 Vue 生态一致
- 更好的类型推导和 IDE 支持
