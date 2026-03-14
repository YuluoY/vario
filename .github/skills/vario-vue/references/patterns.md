# Common Patterns & Recipes

> Practical schema patterns extracted from real examples. Each pattern shows the recommended way to accomplish common UI tasks with @variojs/vue.

## Table of Contents
1. [TypeScript Setup](#typescript-setup)
2. [Form Pattern](#form-pattern)
3. [Data Table Pattern](#data-table-pattern)
4. [Loop with Cards](#loop-with-cards)
5. [Scoped Slots](#scoped-slots)
6. [Computed Chain](#computed-chain)
7. [Conditional UI States](#conditional-ui-states)
8. [Event Patterns](#event-patterns)
9. [Dialog / Modal](#dialog--modal)
10. [Pagination](#pagination)

---

## TypeScript Setup

Always type your state interface extending `Record<string, unknown>`, and use `Schema<S>` generic:

```ts
import { useVario, type MethodContext } from '@variojs/vue'
import type { Schema } from '@variojs/schema'
import type { App } from 'vue'

interface MyState extends Record<string, unknown> {
  name: string
  items: Item[]
  // computed fields (optional in interface)
  total?: number
}

const schema: Schema<MyState> = { /* ... */ }

const { vnode, state, ctx } = useVario(schema, {
  app,                    // Vue app instance for component resolution
  state: { name: '', items: [] },
  computed: { total: (s) => s.items.length },
  methods: {
    doSomething: ({ state, params }: MethodContext<MyState>) => { /* ... */ }
  },
  onError: (error: Error) => console.error(error)
})
```

**Key points:**
- `Schema<MyState>` enables type checking on model paths and expression references
- `MethodContext<MyState>` gives typed `state`, plus `params`, `value`, `event`, `ctx`
- `ctx._get(path)` / `ctx._set(path, value)` for programmatic state access
- `state` returned by `useVario` is reactive — use directly in templates

---

## Form Pattern

Complete form with validation feedback, model binding, computed validation, and submit handling:

```ts
const formSchema: Schema<FormState> = {
  type: 'ElForm',
  props: { labelWidth: '120px' },
  children: [
    // Text input with model binding
    {
      type: 'ElFormItem',
      props: { label: '名称', error: '{{ errors.name }}' },
      children: [{
        type: 'ElInput',
        model: 'name',
        props: { placeholder: '请输入名称', maxlength: 50, showWordLimit: true }
      }]
    },
    // Number input
    {
      type: 'ElFormItem',
      props: { label: '数量' },
      children: [{
        type: 'ElInputNumber',
        model: 'quantity',
        props: { min: 0, max: 999 }
      }]
    },
    // Select dropdown
    {
      type: 'ElFormItem',
      props: { label: '分类' },
      children: [{
        type: 'ElSelect',
        model: 'category',
        props: { placeholder: '请选择' },
        children: [
          { type: 'ElOption', props: { value: 'a', label: '选项A' } },
          { type: 'ElOption', props: { value: 'b', label: '选项B' } }
        ]
      }]
    },
    // Submit button with loading state
    {
      type: 'ElButton',
      props: { type: 'primary', loading: '{{ isSubmitting }}', disabled: '{{ !isValid }}' },
      events: { click: [{ type: 'call', method: 'submit' }] },
      children: '提交'
    },
    // Success message (conditional)
    {
      type: 'ElAlert',
      cond: '{{ submitSuccess }}',
      props: { type: 'success', title: '提交成功', closable: false }
    }
  ]
}
```

**useVario options:**

```ts
useVario(formSchema, {
  app,
  state: { name: '', quantity: 0, category: '', isSubmitting: false, submitSuccess: false },
  computed: {
    errors: (s) => {
      const e: Record<string, string> = {}
      if (!s.name) e.name = '名称不能为空'
      return e
    },
    isValid: (s) => Object.keys(s.errors || {}).length === 0
  },
  methods: {
    submit: async ({ state }: MethodContext<FormState>) => {
      state.isSubmitting = true
      await apiCall(state)
      state.isSubmitting = false
      state.submitSuccess = true
    }
  }
})
```

---

## Data Table Pattern

Table with scoped slot columns, action buttons, and event handling:

```ts
{
  type: 'ElTable',
  props: { data: '{{ paginatedProducts }}', style: 'width: 100%;' },
  events: {
    'selection-change': [{ type: 'call', method: 'handleSelect', params: '{{ $event }}' }]
  },
  children: [
    // Selection column
    { type: 'ElTableColumn', props: { type: 'selection', width: '55' } },
    // Plain column
    { type: 'ElTableColumn', props: { prop: 'name', label: '名称', sortable: true } },
    // Column with scoped slot for custom rendering
    {
      type: 'ElTableColumn',
      props: { prop: 'status', label: '状态', width: '100' },
      children: [{
        type: 'template',
        slot: 'default',
        props: { scope: 'scope' },
        children: [{
          type: 'ElTag',
          props: { type: '{{ scope.row.status === "active" ? "success" : "info" }}' },
          children: '{{ scope.row.status === "active" ? "启用" : "禁用" }}'
        }]
      }]
    },
    // Action column with row params
    {
      type: 'ElTableColumn',
      props: { label: '操作', width: '200', fixed: 'right' },
      children: [{
        type: 'template',
        slot: 'default',
        props: { scope: 'scope' },
        children: [
          {
            type: 'ElButton',
            props: { type: 'primary', size: 'small', link: true },
            events: { click: [{ type: 'call', method: 'edit', params: '{{ scope.row }}' }] },
            children: '编辑'
          },
          {
            type: 'ElButton',
            props: { type: 'danger', size: 'small', link: true },
            events: { click: [{ type: 'call', method: 'delete', params: '{{ scope.row }}' }] },
            children: '删除'
          }
        ]
      }]
    }
  ]
}
```

**Scoped slot key points:**
- `type: 'template'` + `slot: 'default'` + `props: { scope: 'scope' }` creates a scoped slot
- Access row data via `scope.row` in expressions
- Pass row data to methods via `params: '{{ scope.row }}'`

---

## Loop with Cards

Product grid using `loop` with itemKey for list rendering:

```ts
{
  type: 'ElRow',
  props: { gutter: 20 },
  children: [{
    type: 'ElCol',
    loop: { items: '{{ products }}', itemKey: 'product' },
    props: { span: 6, style: 'margin-bottom: 20px;' },
    children: [{
      type: 'ElCard',
      props: { shadow: 'hover' },
      children: [
        { type: 'div', children: '{{ product.name }}' },
        { type: 'div', children: '¥{{ product.price }}' },
        {
          type: 'ElButton',
          props: { disabled: '{{ product.stock === 0 }}' },
          events: {
            click: [{ type: 'call', method: 'addToCart', params: { productId: '{{ product.id }}' } }]
          },
          children: '{{ product.stock === 0 ? "缺货" : "加入购物车" }}'
        }
      ]
    }]
  }]
}
```

**Loop key points:**
- `loop: { items: '{{ array }}', itemKey: 'varName' }` — itemKey names the loop variable
- Access loop variable in children expressions: `{{ varName.property }}`
- Pass structured params: `params: { productId: '{{ product.id }}' }`
- For performance with large lists, the Scope-Weight Hybrid strategy automatically componentizes loop items when template weight > COMPONENT_OVERHEAD

---

## Scoped Slots

Three patterns for slot usage:

### 1. Named scoped slot (e.g., table column)
```ts
{ type: 'template', slot: 'default', props: { scope: 'scope' },
  children: '{{ scope.row.name }}' }
```

### 2. Named slot without scope (e.g., dialog footer)
```ts
{ type: 'template', slot: 'footer',
  children: [
    { type: 'ElButton', events: { click: [{ type: 'call', method: 'cancel' }] }, children: '取消' },
    { type: 'ElButton', props: { type: 'primary' }, events: { click: [{ type: 'call', method: 'confirm' }] }, children: '确认' }
  ] }
```

### 3. Prefix slot (e.g., input prefix)
```ts
{ type: 'template', slot: 'prefix',
  children: [{ type: 'ElIcon', children: [{ type: 'Search' }] }] }
```

**Detection rule:** A node with `type: 'template'` and a `slot` property is recognized as a slot definition. If `props.scope` exists, it creates a scoped slot with that variable name.

---

## Computed Chain

For derived data that depends on other derived data, use chained computed properties:

```ts
computed: {
  // Step 1: Filter
  filteredProducts: (s) => s.products.filter(p => {
    const matchKeyword = !s.searchKeyword || p.name.toLowerCase().includes(s.searchKeyword.toLowerCase())
    const matchCategory = !s.selectedCategory || p.category === s.selectedCategory
    return matchKeyword && matchCategory
  }),
  // Step 2: Sort (depends on filteredProducts)
  sortedProducts: (s) => {
    if (!s.sortField) return s.filteredProducts
    return [...(s.filteredProducts || [])].sort(/* ... */)
  },
  // Step 3: Paginate (depends on sortedProducts)
  paginatedProducts: (s) => {
    const start = (s.currentPage - 1) * s.pageSize
    return (s.sortedProducts || []).slice(start, start + s.pageSize)
  },
  // Derived counts
  totalCount: (s) => (s.filteredProducts || []).length,
  totalPages: (s) => Math.max(1, Math.ceil((s.totalCount || 0) / s.pageSize))
}
```

**Key points:**
- Computed functions receive the full state `s` which includes other computed values
- Chain: `filteredProducts` → `sortedProducts` → `paginatedProducts`
- Use `(s.computedProp || [])` for safe access since computed may be undefined at init

---

## Conditional UI States

Use `cond` for if/else rendering, `show` for visibility toggle:

```ts
// Either show the cart OR the product list (cond = v-if)
{ type: 'div', cond: '{{ showCart }}',    children: [/* cart UI */] },
{ type: 'div', cond: '{{ !showCart }}',   children: [/* product list */] },

// Empty state within the cart
{ type: 'div', cond: '{{ cartEmpty }}',   children: '购物车是空的' },
{ type: 'div', cond: '{{ !cartEmpty }}',  children: [/* cart items */] },

// show = v-show (element stays in DOM, just hidden)
{ type: 'div', show: '{{ hasWarning }}',  children: '⚠️ Warning' },

// Conditional button appearance
{
  type: 'ElButton',
  cond: '{{ selectedIds.length > 0 }}',
  children: '批量删除 ({{ selectedIds.length }})'
}
```

**Toggle via set action:**
```ts
events: { click: [{ type: 'set', path: 'showCart', value: '{{ !showCart }}' }] }
```

---

## Event Patterns

### Direct set action (simplest)
```ts
events: { click: [{ type: 'set', path: 'count', value: '{{ count + 1 }}' }] }
```

### Method call
```ts
events: { click: [{ type: 'call', method: 'handleClick' }] }
```

### Method call with params
```ts
events: { click: [{ type: 'call', method: 'edit', params: '{{ scope.row }}' }] }
// or structured params
events: { click: [{ type: 'call', method: 'addToCart', params: { productId: '{{ product.id }}' } }] }
```

### Chained actions (sequential execution)
```ts
events: {
  'size-change': [
    { type: 'set', path: 'pageSize', value: '{{ $event }}' },
    { type: 'set', path: 'currentPage', value: 1 }
  ]
}
```

### Using $event
```ts
events: { 'current-change': [{ type: 'set', path: 'currentPage', value: '{{ $event }}' }] }
```

### Emit action
```ts
events: { click: [{ type: 'emit', event: 'save', params: '{{ formData }}' }] }
```

---

## Dialog / Modal

Dialog pattern with model binding for visibility and footer slots:

```ts
{
  type: 'ElDialog',
  model: 'editDialogVisible',                 // binds to v-model (open/close)
  props: { title: '编辑', width: '500px' },
  children: [
    // Dialog body — form content
    {
      type: 'ElForm',
      props: { labelWidth: '80px' },
      children: [
        { type: 'ElFormItem', props: { label: '名称' }, children: [{
          type: 'ElInput', model: 'editingProduct.name'   // nested model path
        }] }
      ]
    },
    // Dialog footer slot
    {
      type: 'template',
      slot: 'footer',
      children: [
        { type: 'ElButton', events: { click: [{ type: 'call', method: 'cancelEdit' }] }, children: '取消' },
        { type: 'ElButton', props: { type: 'primary' }, events: { click: [{ type: 'call', method: 'saveEdit' }] }, children: '保存' }
      ]
    }
  ]
}
```

**Key points:**
- `model: 'editDialogVisible'` binds dialog open state to a boolean in state
- Nested model path `editingProduct.name` binds to a property of an object in state
- Footer slot via `type: 'template'` + `slot: 'footer'`

---

## Pagination

Pagination with page change and page size change events:

```ts
{
  type: 'div',
  props: { style: 'display: flex; justify-content: space-between; align-items: center;' },
  children: [
    { type: 'div', children: '共 {{ totalCount }} 条记录，第 {{ currentPage }} / {{ totalPages }} 页' },
    {
      type: 'ElPagination',
      props: {
        currentPage: '{{ currentPage }}',
        pageSize: '{{ pageSize }}',
        total: '{{ totalCount }}',
        pageSizes: [10, 20, 50, 100],
        layout: 'sizes, prev, pager, next, jumper'
      },
      events: {
        'current-change': [{ type: 'set', path: 'currentPage', value: '{{ $event }}' }],
        'size-change': [
          { type: 'set', path: 'pageSize', value: '{{ $event }}' },
          { type: 'set', path: 'currentPage', value: 1 }
        ]
      }
    }
  ]
}
```

**Key points:**
- Expression props like `currentPage: '{{ currentPage }}'` make the component reactive
- `$event` captures the emitted value from component events
- Chain multiple set actions for size-change to reset pagination
- Text interpolation `{{ totalCount }}` works directly in children strings
