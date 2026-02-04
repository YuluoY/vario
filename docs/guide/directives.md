# 自定义指令

Vario 支持自定义指令（Directives），类似 Vue 的 `v-directive` 和 `withDirectives` API，允许你扩展元素的行为。

## 快速开始

最简单的指令使用：

```typescript
const schema: SchemaNode = {
  type: 'input',
  directives: {
    focus: true  // 对象映射简写
  }
}

const renderer = new VueRenderer({
  directives: {
    focus: {
      mounted(el) {
        el.focus()
      }
    }
  }
})
```

## 指令语法格式

Vario 支持多种指令配置格式，参考 Vue 的 `withDirectives` API 设计：

### 1. 对象映射简写

最简洁的方式，适合简单场景：

```typescript
{
  type: 'input',
  directives: {
    focus: true,
    custom: 'someValue'
  }
}
```

### 2. 完整对象格式

提供完整配置，包括值、参数和修饰符：

```typescript
{
  type: 'input',
  directives: {
    name: 'custom',
    value: 'myValue',
    arg: 'param',
    modifiers: { lazy: true, trim: true }
  }
}
```

### 3. 数组简写格式

类似 Vue 的 `withDirectives` API：

```typescript
// [name, value?, arg?, modifiers?]
{
  type: 'input',
  directives: ['focus', true]
}
```

完整参数：

```typescript
{
  type: 'input',
  directives: ['custom', 'myValue', 'param', { lazy: true }]
}
```

### 4. 多个指令（数组）

支持应用多个指令：

```typescript
{
  type: 'input',
  directives: [
    ['focus', true],
    ['custom', 'value', 'arg', { modifier: true }]
  ]
}
```

或混合格式：

```typescript
{
  type: 'input',
  directives: [
    { name: 'focus', value: true },
    ['custom', 'value']
  ]
}
```

## 指令定义

### 基本指令

定义一个简单的指令：

```typescript
const vFocus = {
  mounted(el) {
    el.focus()
  }
}

const renderer = new VueRenderer({
  directives: {
    focus: vFocus
  }
})
```

### 完整生命周期

指令支持 Vue 3 的所有生命周期钩子：

```typescript
const vCustom = {
  // 元素被挂载时
  mounted(el, binding) {
    console.log('Mounted:', binding.value)
  },
  
  // 元素更新前
  beforeUpdate(el, binding) {
    console.log('Before update')
  },
  
  // 元素更新后
  updated(el, binding) {
    console.log('Updated:', binding.value)
  },
  
  // 元素卸载前
  beforeUnmount(el, binding) {
    console.log('Before unmount')
  },
  
  // 元素被卸载时
  unmounted(el) {
    console.log('Unmounted')
  }
}
```

### Binding 对象

指令钩子接收的 `binding` 对象包含：

```typescript
{
  value: any,           // 指令的值
  oldValue: any,        // 之前的值（仅 updated 和 componentUpdated 可用）
  arg: string,          // 指令参数
  modifiers: object,    // 修饰符对象
  instance: Component,  // 组件实例
  dir: Directive        // 指令定义对象
}
```

## 表达式求值

指令的值支持表达式：

```typescript
{
  type: 'input',
  directives: {
    custom: '{{ dynamicValue }}'  // 会自动求值
  }
}
```

在 runtime context 中：

```typescript
const { state } = useVario(schema, {
  state: {
    dynamicValue: 'Hello from state'
  }
})
```

## 内置指令

Vario 提供了一些内置指令：

### v-focus

自动聚焦元素：

```typescript
{
  type: 'input',
  directives: {
    focus: true
  }
}
```

或使用数组简写：

```typescript
{
  type: 'input',
  directives: ['focus', true]
}
```

## 完整示例

### 示例 1：点击外部关闭

```typescript
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!el.contains(event.target)) {
        binding.value()
      }
    }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  }
}

const schema: SchemaNode = {
  type: 'div',
  directives: ['clickOutside', '{{ handleClickOutside }}'],
  children: '点击外部关闭'
}

const { methods } = useVario(schema, {
  methods: {
    handleClickOutside: () => {
      console.log('Clicked outside!')
    }
  }
}, {
  directives: {
    clickOutside: vClickOutside
  }
})
```

### 示例 2：权限控制

```typescript
const vPermission = {
  mounted(el, binding) {
    const { value, arg, modifiers } = binding
    const hasPermission = checkPermission(value)
    
    if (!hasPermission) {
      if (modifiers.hide) {
        el.style.display = 'none'
      } else {
        el.disabled = true
      }
    }
  }
}

const schema: SchemaNode = {
  type: 'button',
  directives: ['permission', 'admin', undefined, { hide: true }],
  children: '管理员操作'
}
```

### 示例 3：懒加载图片

```typescript
const vLazyLoad = {
  mounted(el, binding) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          el.src = binding.value
          observer.unobserve(el)
        }
      })
    })
    observer.observe(el)
    el._observer = observer
  },
  unmounted(el) {
    el._observer?.disconnect()
  }
}

const schema: SchemaNode = {
  type: 'img',
  directives: {
    name: 'lazyLoad',
    value: '{{ imageUrl }}'
  }
}
```

## 指令注册

### 渲染器级别注册

在创建渲染器时注册：

```typescript
const renderer = new VueRenderer({
  directives: {
    focus: vFocus,
    clickOutside: vClickOutside,
    permission: vPermission
  }
})
```

### 应用级别注册

在 Vue 应用中注册：

```typescript
const app = createApp(App)

app.directive('focus', vFocus)
app.directive('clickOutside', vClickOutside)

// 传递给渲染器
const renderer = new VueRenderer({
  app  // 会自动使用应用中注册的指令
})
```

## 最佳实践

1. **简单场景用对象映射**：
   ```typescript
   directives: { focus: true }
   ```

2. **需要参数时用数组简写**：
   ```typescript
   directives: ['permission', 'admin', undefined, { strict: true }]
   ```

3. **多个指令用数组**：
   ```typescript
   directives: [
     ['focus', true],
     ['tooltip', '{{ message }}']
   ]
   ```

4. **复杂配置用完整对象**：
   ```typescript
   directives: {
     name: 'custom',
     value: '{{ data }}',
     arg: 'param',
     modifiers: { lazy: true, debounce: true }
   }
   ```

## 与 Vue 的对比

Vario 的指令系统参考了 Vue 3 的 `withDirectives` API：

```typescript
// Vue 3
withDirectives(vnode, [
  [vFocus, true],
  [vCustom, 'value', 'arg', { modifier: true }]
])

// Vario
{
  directives: [
    ['focus', true],
    ['custom', 'value', 'arg', { modifier: true }]
  ]
}
```

主要特性：
- ✅ 数组简写格式 `[name, value, arg, modifiers]`
- ✅ 支持表达式求值
- ✅ 完整的生命周期钩子
- ✅ Binding 对象包含所有必要信息
- ✅ 支持多个指令组合

## 注意事项

1. **withDirectives 警告**：在非渲染函数中使用可能会看到 Vue 警告，这是正常的，不影响功能

2. **指令顺序**：多个指令按数组顺序执行

3. **性能考虑**：避免在指令中执行耗时操作，考虑使用防抖或节流

4. **清理资源**：在 `unmounted` 钩子中清理事件监听器、定时器等

## 参考

- [Vue 3 自定义指令](https://cn.vuejs.org/guide/reusability/custom-directives.html)
- [Vue 3 withDirectives API](https://cn.vuejs.org/api/render-function.html#withdirectives)
- [表达式语法](./expression.md)
