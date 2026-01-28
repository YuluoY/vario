# 表达式系统

Schema 中支持表达式语法，使用 `{{ }}` 包裹：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'div',
      children: '{{ firstName + " " + lastName }}'  // 字符串拼接
    },
    {
      type: 'div',
      children: '{{ count * 2 }}'  // 数学运算
    },
    {
      type: 'div',
      show: 'count > 10',  // 条件显示
      children: 'Count is greater than 10'
    }
  ]
}
```

表达式在 Vue 的响应式上下文中求值，会自动追踪依赖。
