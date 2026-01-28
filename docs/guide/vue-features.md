# Vue 特性集成

## Ref 模板引用

在 Schema 中声明 `ref`，通过 `useVario` 返回的 `refs` 访问组件实例。

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'ElInput',
      ref: 'inputRef',
      props: { modelValue: '{{ inputValue }}' }
    },
    {
      type: 'ElButton',
      events: {
        click: { type: 'call', method: 'focusInput' }
      },
      children: '聚焦输入框'
    }
  ]
}

const { refs, methods } = useVario(schema, {
  state: { inputValue: '' },
  methods: {
    focusInput: () => {
      refs.inputRef.value?.focus()
    }
  }
})
```

## 生命周期钩子

在 Schema 中声明生命周期钩子方法名，映射到 Vue 原生 API。

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  onMounted: 'initData',
  onUnmounted: 'cleanup',
  onUpdated: 'onUpdate',
  onBeforeMount: 'beforeInit',
  onBeforeUnmount: 'beforeCleanup',
  onBeforeUpdate: 'beforeUpdate',
  children: 'Content'
}

const { methods } = useVario(schema, {
  methods: {
    initData: ({ state, ctx }) => { /* 挂载后 */ },
    cleanup: ({ state, ctx }) => { /* 即将卸载 */ }
  }
})
```

## Provide/Inject 依赖注入

```typescript
// 父
const parentSchema: VueSchemaNode = {
  type: 'div',
  provide: {
    theme: 'dark',
    locale: 'currentLocale',
    apiUrl: 'https://api.example.com'
  },
  children: [{ type: 'ChildComponent' }]
}

// 子
const childSchema: VueSchemaNode = {
  type: 'div',
  inject: ['theme', 'locale'],
  // 或 inject: { myTheme: 'theme', appLocale: { from: 'locale', default: 'en-US' } }
  children: [{ type: 'div', children: 'Theme: {{ theme }}, Locale: {{ locale }}' }]
}
```

## Teleport 传送

```typescript
{
  type: 'ElDialog',
  teleport: 'body',
  props: { modelValue: '{{ dialogVisible }}' },
  children: '对话框内容'
}
```

## Transition 过渡动画

```typescript
{
  type: 'div',
  transition: 'fade',
  // 或 transition: { name: 'fade', appear: true, mode: 'out-in', duration: { enter: 300, leave: 200 } },
  children: 'Content'
}
```

## Keep-Alive 缓存

```typescript
{
  type: 'div',
  keepAlive: true,
  // 或 keepAlive: { include: 'ComponentA', exclude: 'ComponentB', max: 10 },
  children: 'Content'
}
```
