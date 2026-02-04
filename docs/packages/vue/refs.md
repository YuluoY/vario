# Refs（模板引用）

Vario 支持类似 Vue 的模板引用（Template Refs）功能，允许你在 Schema 中声明 ref，并通过 `useVario` 返回的 `refs` 对象访问组件实例或 DOM 元素。

## 基本用法

### 声明 Ref

在 Schema 节点上使用 `ref` 属性声明引用：

```typescript
const schema = {
  type: 'input',
  ref: 'myInput',  // 声明 ref
  props: {
    type: 'text',
    placeholder: '请输入...'
  }
}

const { refs } = useVario(schema)

// 访问引用
onMounted(() => {
  refs.myInput.value?.focus()  // 聚焦输入框
})
```

### 访问 Ref

`refs` 是一个响应式对象，每个 ref 都是一个 Vue `Ref`：

```typescript
const { refs } = useVario(schema)

// refs.myInput 是 Ref<HTMLInputElement | null>
console.log(refs.myInput.value)  // HTMLInputElement 或 null

// 在组件挂载后访问
onMounted(() => {
  if (refs.myInput.value) {
    refs.myInput.value.focus()
  }
})
```

## 使用场景

### 1. 表单输入控制

```typescript
const schema = {
  type: 'div',
  children: [
    {
      type: 'input',
      ref: 'nameInput',
      model: 'form.name'
    },
    {
      type: 'button',
      events: {
        click: 'focusName'
      },
      children: '聚焦到姓名'
    }
  ]
}

const { refs } = useVario(schema, {
  state: {
    form: { name: '' }
  },
  methods: {
    focusName: () => {
      refs.nameInput.value?.focus()
    }
  }
})
```

### 2. 调用组件方法

```typescript
const schema = {
  type: 'ElForm',
  ref: 'formRef',
  props: {
    model: '{{ form }}',
    rules: '{{ rules }}'
  },
  children: [
    // ... form items
  ]
}

const { refs } = useVario(schema, {
  state: {
    form: { name: '', email: '' },
    rules: {
      name: [{ required: true, message: '请输入姓名' }]
    }
  },
  methods: {
    validate: async () => {
      try {
        await refs.formRef.value?.validate()
        console.log('验证通过')
      } catch (error) {
        console.log('验证失败', error)
      }
    },
    
    resetForm: () => {
      refs.formRef.value?.resetFields()
    }
  }
})
```

### 3. 获取 DOM 尺寸

```typescript
const schema = {
  type: 'div',
  ref: 'container',
  children: '内容'
}

const { refs } = useVario(schema)

onMounted(() => {
  const el = refs.container.value
  if (el) {
    console.log('宽度:', el.offsetWidth)
    console.log('高度:', el.offsetHeight)
    console.log('位置:', el.getBoundingClientRect())
  }
})
```

### 4. 滚动控制

```typescript
const schema = {
  type: 'div',
  ref: 'scrollContainer',
  props: {
    style: { height: '300px', overflow: 'auto' }
  },
  children: [
    // ... 长列表
  ]
}

const { refs } = useVario(schema, {
  methods: {
    scrollToTop: () => {
      refs.scrollContainer.value?.scrollTo({ top: 0, behavior: 'smooth' })
    },
    
    scrollToBottom: () => {
      const el = refs.scrollContainer.value
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      }
    }
  }
})
```

## 在循环中使用 Ref

### 数组 Ref

在 loop 中使用 ref 时，自动收集为数组：

```typescript
const schema = {
  type: 'div',
  children: [{
    type: 'div',
    loop: {
      items: 'items',
      itemKey: 'item'
    },
    ref: 'itemRefs',  // 会自动收集为数组
    children: '{{ item.name }}'
  }]
}

const { refs } = useVario(schema, {
  state: {
    items: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' }
    ]
  }
})

onMounted(() => {
  console.log(refs.itemRefs.value)  // [HTMLDivElement, HTMLDivElement, HTMLDivElement]
  
  // 访问第一个元素
  refs.itemRefs.value[0]?.scrollIntoView()
})
```

### 动态 Ref 名称

使用表达式生成动态的 ref 名称：

```typescript
const schema = {
  type: 'div',
  children: [{
    type: 'input',
    loop: {
      items: 'fields',
      itemKey: 'field',
      indexKey: 'index'
    },
    ref: '{{ `field_${index}` }}',  // 动态 ref 名称
    model: '{{ `form.${field.name}` }}'
  }]
}

const { refs } = useVario(schema, {
  state: {
    fields: [
      { name: 'name' },
      { name: 'email' },
      { name: 'phone' }
    ],
    form: {}
  }
})

onMounted(() => {
  // 访问特定字段
  refs.field_0.value?.focus()
  refs.field_1.value?.select()
})
```

## Ref 的生命周期

### 自动注册

ref 在组件挂载时自动注册，不需要手动初始化：

```typescript
const { refs } = useVario(schema)

// refs 已经包含所有声明的 ref
console.log(refs.myInput)  // Ref<any>
```

### 懒加载

refs 使用 Proxy 实现懒加载，访问时才创建：

```typescript
const { refs } = useVario(schema)

// 即使 Schema 中未声明，访问时也会自动创建
console.log(refs.nonExistent)  // Ref<null>
```

### 清理

组件卸载时，refs 会自动清理：

```typescript
onUnmounted(() => {
  // refs 已自动清理，不需要手动处理
})
```

## RefsRegistry API

### 手动注册

```typescript
import { RefsRegistry } from '@variojs/vue'

const registry = new RefsRegistry()

// 注册 ref
const myRef = registry.register('myInput')

// 获取 ref
const ref = registry.get('myInput')

// 获取所有 refs
const allRefs = registry.getAll()
```

### 移除 Ref

```typescript
const registry = new RefsRegistry()

registry.register('myInput')

// 移除单个 ref
registry.remove('myInput')

// 清除所有 refs
registry.clear()
```

## 类型安全

### TypeScript 类型推导

使用 TypeScript 时，可以为 refs 定义明确的类型：

```typescript
import type { Ref } from 'vue'

interface MyRefs {
  myInput: Ref<HTMLInputElement | null>
  formRef: Ref<FormInstance | null>
  container: Ref<HTMLDivElement | null>
}

const schema = {
  type: 'div',
  ref: 'container',
  children: [
    {
      type: 'input',
      ref: 'myInput'
    },
    {
      type: 'ElForm',
      ref: 'formRef'
    }
  ]
}

const { refs } = useVario(schema)

// 类型断言
const typedRefs = refs as unknown as MyRefs

onMounted(() => {
  typedRefs.myInput.value?.focus()  // ✅ 类型安全
  typedRefs.formRef.value?.validate()  // ✅ 类型安全
})
```

### 组件类型

为组件实例定义类型：

```typescript
import type { FormInstance } from 'element-plus'

const schema = {
  type: 'ElForm',
  ref: 'form'
}

const { refs } = useVario(schema)

onMounted(() => {
  const form = refs.form.value as FormInstance | null
  if (form) {
    form.validate()  // ✅ 有完整的类型提示
  }
})
```

## 实用模式

### 1. 命令式操作

```typescript
const schema = {
  type: 'div',
  children: [
    {
      type: 'ElDialog',
      ref: 'dialog',
      props: {
        modelValue: '{{ showDialog }}'
      }
    },
    {
      type: 'button',
      events: { click: 'openDialog' }
    }
  ]
}

useVario(schema, {
  state: { showDialog: false },
  methods: {
    openDialog: ({ state }) => {
      state.showDialog = true
      
      // 等待 DOM 更新后操作 ref
      nextTick(() => {
        refs.dialog.value?.focus()
      })
    }
  }
})
```

### 2. 焦点管理

```typescript
const useFocusManagement = (refs: Record<string, Ref<any>>) => {
  const focusStack = ref<string[]>([])
  
  const pushFocus = (refName: string) => {
    focusStack.value.push(refName)
    refs[refName].value?.focus()
  }
  
  const popFocus = () => {
    focusStack.value.pop()
    const prev = focusStack.value[focusStack.value.length - 1]
    if (prev) {
      refs[prev].value?.focus()
    }
  }
  
  return { pushFocus, popFocus }
}

const { refs } = useVario(schema)
const { pushFocus, popFocus } = useFocusManagement(refs)
```

### 3. Ref 组合

```typescript
const useRefs = () => {
  const refs = ref<Record<string, Ref<any>>>({})
  
  const setRef = (name: string, el: any) => {
    if (!refs.value[name]) {
      refs.value[name] = ref(el)
    } else {
      refs.value[name].value = el
    }
  }
  
  const getRef = (name: string) => {
    return refs.value[name]?.value
  }
  
  return { refs, setRef, getRef }
}
```

## 注意事项

1. **访问时机**：ref 在组件挂载后才可用，应在 `onMounted` 或之后访问
2. **响应式**：refs 中的每个 ref 都是响应式的，需要通过 `.value` 访问
3. **null 检查**：访问 ref 前应检查是否为 null
4. **命名冲突**：避免使用重复的 ref 名称
5. **循环中的 ref**：循环中的 ref 会自动收集为数组
6. **清理**：不需要手动清理 refs，组件卸载时会自动处理

## 最佳实践

1. **语义化命名**：使用清晰的 ref 名称，如 `submitButton`、`nameInput`
2. **类型安全**：使用 TypeScript 定义 refs 类型
3. **避免过度使用**：优先使用声明式 API（如 model、events），必要时才用 ref
4. **封装操作**：将复杂的 ref 操作封装为可复用的函数
5. **文档注释**：为 ref 添加注释说明其用途

## 与 Vue Ref 的对比

Vario 的 ref 系统与 Vue 的模板引用完全兼容：

```vue
<!-- Vue Template -->
<template>
  <input ref="myInput" />
</template>

<script setup>
const myInput = ref<HTMLInputElement>()

onMounted(() => {
  myInput.value?.focus()
})
</script>
```

```typescript
// Vario Schema
const schema = {
  type: 'input',
  ref: 'myInput'
}

const { refs } = useVario(schema)

onMounted(() => {
  refs.myInput.value?.focus()
})
```

## 相关链接

- [API 文档](/packages/vue/api)
- [Vue Refs 文档](https://cn.vuejs.org/guide/essentials/template-refs.html)
- [类型定义](/packages/vue/types)
- [Vue 特性](/guide/vue-features)
