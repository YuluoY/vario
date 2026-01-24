import type { Schema } from '@variojs/schema'
import type { RuntimeContext } from '@variojs/core'

/**
 * 方法上下文类型
 */
export interface MethodContext<TState extends Record<string, unknown> = Record<string, unknown>> {
  state: TState
  params: any
  event?: Event
  ctx: RuntimeContext<TState>
}

/**
 * 方法类型定义
 */
export type ExampleMethods = Record<string, (ctx: MethodContext<any>) => any>

/**
 * 示例配置类型定义
 */
export interface ExampleItem {
  codeId: string
  titleKey: string
  code: string
  schema: Schema | null
  icon: string
  language: string
  showPreview: boolean
  category: 'schema' | 'instruction' | 'expression' | 'application'
  // 预览时的初始状态
  initialState?: Record<string, any>
  // 预览时的方法
  methods?: ExampleMethods
}

// ==================== Schema 示例 ====================

export const buttonExample: ExampleItem = {
  codeId: 'button',
  titleKey: 'examples.buttonComponent',
  code: `{
  "type": "ElButton",
  "props": {
    "type": "primary",
    "size": "large"
  },
  "events": {
    "click": [
      { "type": "call", "method": "handleClick" }
    ]
  },
  "children": "Click Me"
}`,
  schema: {
    type: 'ElButton',
    props: {
      type: 'primary',
      size: 'large'
    },
    events: {
      click: [
        { type: 'call', method: 'handleClick' }
      ]
    },
    children: 'Click Me'
  },
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: true,
  category: 'schema'
}

export const inputExample: ExampleItem = {
  codeId: 'input',
  titleKey: 'examples.formInput',
  code: `{
  "type": "ElInput",
  "props": {
    "placeholder": "Enter text..."
  },
  "model": "inputValue",
  "events": {
    "change": [
      { "type": "call", "method": "onInputChange" }
    ]
  }
}`,
  schema: {
    type: 'ElInput',
    props: {
      placeholder: 'Enter text...'
    },
    model: 'inputValue',
    events: {
      change: [
        { type: 'call', method: 'onInputChange' }
      ]
    }
  },
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: true,
  category: 'schema'
}

export const listExample: ExampleItem = {
  codeId: 'list',
  titleKey: 'examples.listWithLoop',
  code: `{
  "type": "div",
  "props": { "style": "display: flex; flex-wrap: wrap; gap: 10px; padding: 20px;" },
  "children": [
    {
      "type": "h4",
      "props": { "style": "width: 100%; margin-bottom: 10px;" },
      "children": "Items List:"
    },
    {
      "type": "ElTag",
      "loop": {
        "items": "{{ items }}"
      },
      "props": {
        "type": "primary",
        "style": "margin-right: 8px; margin-bottom: 8px;"
      },
      "children": "{{ $index + 1 }}. {{ $record }}"
    }
  ]
}`,
  schema: {
    type: 'div',
    props: { style: 'display: flex; flex-wrap: wrap; gap: 10px; padding: 20px;' },
    children: [
      {
        type: 'h4',
        props: { style: 'width: 100%; margin-bottom: 10px;' },
        children: 'Items List:'
      },
      {
        type: 'ElTag',
        loop: {
          items: '{{ items }}',
          itemKey: '$index'
        },
        props: {
          type: 'primary',
          style: 'margin-right: 8px; margin-bottom: 8px;'
        },
        children: '{{ $index + 1 }}. {{ $record }}'
      }
    ]
  },
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: true,
  category: 'schema'
}

export const conditionalExample: ExampleItem = {
  codeId: 'cond',
  titleKey: 'examples.conditionalRendering',
  code: `{
  "type": "ElAlert",
  "cond": "{{ showSuccess }}",
  "props": {
    "type": "success"
  },
  "children": "Operation successful!"
}`,
  schema: {
    type: 'ElAlert',
    cond: '{{ showSuccess }}',
    props: {
      type: 'success'
    },
    children: 'Operation successful!'
  },
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: true,
  category: 'schema'
}

export const cardExample: ExampleItem = {
  codeId: 'card',
  titleKey: 'examples.cardComponent',
  code: `{
  "type": "ElCard",
  "props": {
    "shadow": "hover",
    "style": "max-width: 300px;"
  },
  "children": [
    {
      "type": "div",
      "props": { "style": "text-align: center;" },
      "children": [
        {
          "type": "h3",
          "props": { "style": "margin: 0 0 10px 0;" },
          "children": "{{ title }}"
        },
        {
          "type": "p",
          "props": { "style": "color: #909399; margin: 0;" },
          "children": "{{ description }}"
        }
      ]
    }
  ]
}`,
  schema: {
    type: 'ElCard',
    props: {
      shadow: 'hover',
      style: 'max-width: 300px;'
    },
    children: [
      {
        type: 'div',
        props: { style: 'text-align: center;' },
        children: [
          {
            type: 'h3',
            props: { style: 'margin: 0 0 10px 0;' },
            children: '{{ title }}'
          },
          {
            type: 'p',
            props: { style: 'color: #909399; margin: 0;' },
            children: '{{ description }}'
          }
        ]
      }
    ]
  },
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: true,
  category: 'schema'
}

export const formExample: ExampleItem = {
  codeId: 'form',
  titleKey: 'examples.formComponent',
  code: `{
  "type": "ElForm",
  "props": { "labelWidth": "100px" },
  "children": [
    {
      "type": "ElFormItem",
      "props": { "label": "Name" },
      "children": [
        {
          "type": "ElInput",
          "model": "name",
          "props": { "placeholder": "Enter your name", "clearable": true }
        }
      ]
    },
    {
      "type": "ElFormItem",
      "props": { "label": "Email" },
      "children": [
        {
          "type": "ElInput",
          "model": "email",
          "props": { "type": "email", "placeholder": "Enter your email" }
        }
      ]
    },
    {
      "type": "ElFormItem",
      "children": [
        {
          "type": "ElButton",
          "props": { "type": "primary" },
          "events": { "click": [{ "type": "call", "method": "submit" }] },
          "children": "Submit"
        }
      ]
    }
  ]
}`,
  schema: {
    type: 'ElForm',
    props: { labelWidth: '100px' },
    children: [
      {
        type: 'ElFormItem',
        props: { label: 'Name' },
        children: [
          {
            type: 'ElInput',
            model: 'name',
            props: { placeholder: 'Enter your name', clearable: true }
          }
        ]
      },
      {
        type: 'ElFormItem',
        props: { label: 'Email' },
        children: [
          {
            type: 'ElInput',
            model: 'email',
            props: { type: 'email', placeholder: 'Enter your email' }
          }
        ]
      },
      {
        type: 'ElFormItem',
        children: [
          {
            type: 'ElButton',
            props: { type: 'primary' },
            events: { click: [{ type: 'call', method: 'submit' }] },
            children: 'Submit'
          }
        ]
      }
    ]
  },
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: true,
  category: 'schema'
}

export const tableExample: ExampleItem = {
  codeId: 'table',
  titleKey: 'examples.tableComponent',
  code: `{
  "type": "ElTable",
  "props": {
    "data": "{{ tableData }}",
    "style": "width: 100%;"
  },
  "children": [
    {
      "type": "ElTableColumn",
      "props": { "prop": "name", "label": "Name", "width": "180" }
    },
    {
      "type": "ElTableColumn",
      "props": { "prop": "age", "label": "Age", "width": "180" }
    },
    {
      "type": "ElTableColumn",
      "props": { "prop": "address", "label": "Address" }
    }
  ]
}`,
  schema: {
    type: 'ElTable',
    props: {
      data: '{{ tableData }}',
      style: 'width: 100%;'
    },
    children: [
      {
        type: 'ElTableColumn',
        props: { prop: 'name', label: 'Name', width: '180' }
      },
      {
        type: 'ElTableColumn',
        props: { prop: 'age', label: 'Age', width: '180' }
      },
      {
        type: 'ElTableColumn',
        props: { prop: 'address', label: 'Address' }
      }
    ]
  },
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: true,
  category: 'schema'
}

export const dialogExample: ExampleItem = {
  codeId: 'dialog',
  titleKey: 'examples.dialogComponent',
  code: `{
  "type": "ElDialog",
  "props": {
    "modelValue": "{{ dialogVisible }}",
    "title": "Dialog Title",
    "width": "500px"
  },
  "events": {
    "update:modelValue": [
      { "type": "set", "path": "dialogVisible", "value": "{{ $event }}" }
    ]
  },
  "children": [
    {
      "type": "p",
      "children": "This is dialog content"
    }
  ]
}`,
  schema: {
    type: 'ElDialog',
    props: {
      modelValue: '{{ dialogVisible }}',
      title: 'Dialog Title',
      width: '500px'
    },
    events: {
      'update:modelValue': [
        { type: 'set', path: 'dialogVisible', value: '{{ $event }}' }
      ]
    },
    children: [
      {
        type: 'p',
        children: 'This is dialog content'
      },
      {
        type: 'template',
        slot: 'footer',
        children: [
          {
            type: 'ElButton',
            props: { style: 'margin-right: 10px;' },
            events: {
              click: [{ type: 'set', path: 'dialogVisible', value: false }]
            },
            children: 'Cancel'
          },
          {
            type: 'ElButton',
            props: { type: 'primary' },
            events: {
              click: [{ type: 'call', method: 'confirm' }]
            },
            children: 'Confirm'
          }
        ]
      }
    ]
  },
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: true,
  category: 'schema'
}

export const tabsExample: ExampleItem = {
  codeId: 'tabs',
  titleKey: 'examples.tabsComponent',
  code: `{
  "type": "ElTabs",
  "props": { "modelValue": "{{ activeTab }}" },
  "events": {
    "update:modelValue": [
      { "type": "set", "path": "activeTab", "value": "{{ $event }}" }
    ]
  },
  "children": [
    {
      "type": "ElTabPane",
      "props": { "label": "Tab 1", "name": "tab1" },
      "children": "Content of Tab 1"
    },
    {
      "type": "ElTabPane",
      "props": { "label": "Tab 2", "name": "tab2" },
      "children": "Content of Tab 2"
    },
    {
      "type": "ElTabPane",
      "props": { "label": "Tab 3", "name": "tab3" },
      "children": "Content of Tab 3"
    }
  ]
}`,
  schema: {
    type: 'ElTabs',
    props: { modelValue: '{{ activeTab }}' },
    events: {
      'update:modelValue': [
        { type: 'set', path: 'activeTab', value: '{{ $event }}' }
      ]
    },
    children: [
      {
        type: 'ElTabPane',
        props: { label: 'Tab 1', name: 'tab1' },
        children: 'Content of Tab 1'
      },
      {
        type: 'ElTabPane',
        props: { label: 'Tab 2', name: 'tab2' },
        children: 'Content of Tab 2'
      },
      {
        type: 'ElTabPane',
        props: { label: 'Tab 3', name: 'tab3' },
        children: 'Content of Tab 3'
      }
    ]
  },
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: true,
  category: 'schema'
}

// ==================== 指令示例 ====================

export const setInstructionExample: ExampleItem = {
  codeId: 'set',
  titleKey: 'examples.setValue',
  code: `[
  {
    "type": "set",
    "path": "counter",
    "value": "{{ counter + 1 }}"
  },
  {
    "type": "call",
    "method": "logCounter"
  }
]`,
  schema: null,
  icon: 'Operation',
  language: 'json',
  showPreview: false,
  category: 'instruction'
}

export const ifInstructionExample: ExampleItem = {
  codeId: 'if',
  titleKey: 'examples.conditionalBranch',
  code: `[
  {
    "type": "if",
    "cond": "{{ counter < 10 }}",
    "then": [
      { "type": "call", "method": "handleLowCount" }
    ],
    "else": [
      { "type": "call", "method": "handleHighCount" }
    ]
  }
]`,
  schema: null,
  icon: 'Operation',
  language: 'json',
  showPreview: false,
  category: 'instruction'
}

export const loopInstructionExample: ExampleItem = {
  codeId: 'loop',
  titleKey: 'examples.loopExecution',
  code: `[
  {
    "type": "loop",
    "var": "i",
    "from": 0,
    "to": 5,
    "body": [
      {
        "type": "set",
        "path": "items.{{ i }}",
        "value": "{{ i * 2 }}"
      }
    ]
  }
]`,
  schema: null,
  icon: 'Operation',
  language: 'json',
  showPreview: false,
  category: 'instruction'
}

export const emitInstructionExample: ExampleItem = {
  codeId: 'emit',
  titleKey: 'examples.eventEmission',
  code: `[
  {
    "type": "emit",
    "event": "user-action",
    "data": {
      "action": "click",
      "timestamp": "{{ Date.now() }}"
    }
  }
]`,
  schema: null,
  icon: 'Operation',
  language: 'json',
  showPreview: false,
  category: 'instruction'
}

export const batchInstructionExample: ExampleItem = {
  codeId: 'batch',
  titleKey: 'examples.batchInstruction',
  code: `[
  {
    "type": "batch",
    "instructions": [
      { "type": "set", "path": "a", "value": 1 },
      { "type": "set", "path": "b", "value": 2 },
      { "type": "call", "method": "calculateSum" }
    ]
  }
]`,
  schema: null,
  icon: 'Operation',
  language: 'json',
  showPreview: false,
  category: 'instruction'
}

export const waitInstructionExample: ExampleItem = {
  codeId: 'wait',
  titleKey: 'examples.waitInstruction',
  code: `[
  {
    "type": "wait",
    "ms": 1000
  },
  {
    "type": "call",
    "method": "afterDelay"
  }
]`,
  schema: null,
  icon: 'Operation',
  language: 'json',
  showPreview: false,
  category: 'instruction'
}

// ==================== 表达式示例 ====================

export const accessExpressionExample: ExampleItem = {
  codeId: 'access',
  titleKey: 'examples.propertyAccess',
  code: `user.name
user.profile.age
settings.theme`,
  schema: null,
  icon: 'DataAnalysis',
  language: 'javascript',
  showPreview: false,
  category: 'expression'
}

export const mathExpressionExample: ExampleItem = {
  codeId: 'math',
  titleKey: 'examples.mathOperations',
  code: `count + 1
price * quantity
Math.max(a, b, c)`,
  schema: null,
  icon: 'DataAnalysis',
  language: 'javascript',
  showPreview: false,
  category: 'expression'
}

export const arrayExpressionExample: ExampleItem = {
  codeId: 'array',
  titleKey: 'examples.arrayMethods',
  code: `items.length
items.length > 0 ? items.length : 0
items.slice(0, 5).length`,
  schema: null,
  icon: 'DataAnalysis',
  language: 'javascript',
  showPreview: false,
  category: 'expression'
}

export const conditionalExpressionExample: ExampleItem = {
  codeId: 'conditional',
  titleKey: 'examples.conditional',
  code: `count < 10 ? "Low" : "High"
active ? "On" : "Off"
type === "success" ? "✓" : "✗"`,
  schema: null,
  icon: 'DataAnalysis',
  language: 'javascript',
  showPreview: false,
  category: 'expression'
}

export const functionExpressionExample: ExampleItem = {
  codeId: 'function',
  titleKey: 'examples.functionExpression',
  code: `items.map(item => item.name)
items.filter(item => item.active)
items.reduce((sum, item) => sum + item.price, 0)`,
  schema: null,
  icon: 'DataAnalysis',
  language: 'javascript',
  showPreview: false,
  category: 'expression'
}

export const nestedExpressionExample: ExampleItem = {
  codeId: 'nested',
  titleKey: 'examples.nestedExpression',
  code: `user.profile.settings.theme
data.items[0].name
config.api.endpoints.users`,
  schema: null,
  icon: 'DataAnalysis',
  language: 'javascript',
  showPreview: false,
  category: 'expression'
}

export const logicalExpressionExample: ExampleItem = {
  codeId: 'logical',
  titleKey: 'examples.logicalExpression',
  code: `isActive && hasPermission
!isDisabled || isAdmin
(a > 0 && b < 10) || c === true`,
  schema: null,
  icon: 'DataAnalysis',
  language: 'javascript',
  showPreview: false,
  category: 'expression'
}

// ==================== 应用示例 ====================

export const calculatorExample: ExampleItem = {
  codeId: 'calculator',
  titleKey: 'examples.calculatorApp',
  code: `{
  "type": "div",
  "props": { "class": "calculator-demo", "style": "padding: 24px;" },
  "children": [
    { "type": "h2", "children": "计算器" },
    {
      "type": "ElCard",
      "children": [
        {
          "type": "div",
          "props": { "style": "font-size: 32px; text-align: right; padding: 20px;" },
          "children": "{{ display || '0' }}"
        },
        {
          "type": "div",
          "props": { "style": "display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;" },
          "children": [
            { "type": "ElButton", "events": { "click": [{ "type": "call", "method": "inputNumber", "params": { "num": "7" } }] }, "children": "7" },
            { "type": "ElButton", "events": { "click": [{ "type": "call", "method": "inputNumber", "params": { "num": "8" } }] }, "children": "8" },
            { "type": "ElButton", "events": { "click": [{ "type": "call", "method": "inputNumber", "params": { "num": "9" } }] }, "children": "9" },
            { "type": "ElButton", "props": { "type": "warning" }, "events": { "click": [{ "type": "call", "method": "handleOperator", "params": { "op": "/" } }] }, "children": "÷" }
          ]
        }
      ]
    }
  ]
}`,
  schema: null,
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: false,
  category: 'application'
}

export const todoExample: ExampleItem = {
  codeId: 'todo',
  titleKey: 'examples.todoApp',
  code: `{
  "type": "div",
  "props": { "class": "todo-app", "style": "padding: 20px;" },
  "children": [
    { "type": "h2", "children": "我的待办事项" },
    {
      "type": "ElSpace",
      "children": [
        {
          "type": "ElInput",
          "model": "newTodoText",
          "props": { "placeholder": "请输入新的待办事项..." }
        },
        {
          "type": "ElButton",
          "props": { "type": "primary" },
          "events": { "click": [{ "type": "call", "method": "addTodo" }] },
          "children": "添加"
        }
      ]
    },
    {
      "type": "ElCard",
      "children": [
        {
          "type": "div",
          "loop": { "items": "{{ todos }}", "itemKey": "todo" },
          "children": [
            { "type": "ElCheckbox", "model": "todo.completed" },
            { "type": "ElText", "children": "{{ todo.text }}" }
          ]
        }
      ]
    }
  ]
}`,
  schema: {
    type: 'div',
    props: { class: 'todo-app', style: 'padding: 20px; max-width: 600px;' },
    children: [
      {
        type: 'h2',
        props: { style: 'margin: 0 0 20px 0; font-size: 24px; font-weight: 600;' },
        children: '我的待办事项'
      },
      {
        type: 'ElSpace',
        props: {
          direction: 'horizontal',
          size: 'default',
          style: 'width: 100%; margin-bottom: 20px;'
        },
        children: [
          {
            type: 'ElInput',
            model: 'newTodoText',
            props: {
              placeholder: '请输入新的待办事项...',
              clearable: true,
              style: 'flex: 1;'
            }
          },
          {
            type: 'ElButton',
            props: { type: 'primary' },
            events: {
              click: [
                { type: 'call', method: 'addTodo' }
              ]
            },
            children: '添加'
          }
        ]
      },
      {
        type: 'ElCard',
        props: {
          shadow: 'hover',
          style: 'margin-top: 20px;'
        },
        children: [
          {
            type: 'div',
            loop: {
              items: '{{ todos }}',
              itemKey: 'todo'
            },
            props: {
              style: 'display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #ebeef5;'
            },
            children: [
              {
                type: 'div',
                props: {
                  style: 'display: flex; align-items: center; gap: 12px; flex: 1;'
                },
                children: [
                  {
                    type: 'ElCheckbox',
                    model: 'todo.completed'
                  },
                  {
                    type: 'span',
                    props: {
                      style: '{{ todo.completed ? "text-decoration: line-through; color: #909399;" : "" }}'
                    },
                    children: '{{ todo.text }}'
                  }
                ]
              },
              {
                type: 'ElButton',
                props: {
                  type: 'danger',
                  size: 'small',
                  text: true,
                  circle: true
                },
                events: {
                  click: [
                    {
                      type: 'call',
                      method: 'removeTodo',
                      params: { todoId: '{{ todo.id }}' }
                    }
                  ]
                },
                children: '删除'
              }
            ]
          }
        ]
      }
    ]
  },
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: true,
  category: 'application',
  initialState: {
    todos: [
      { id: 1, text: 'Learn Vario Schema', completed: true },
      { id: 2, text: 'Build a todo app', completed: false },
      { id: 3, text: 'Add more examples', completed: false }
    ],
    newTodoText: ''
  },
  methods: {
    addTodo: ({ state }: MethodContext<any>) => {
      const text = (state as any).newTodoText?.trim()
      if (!text) return
      ;(state as any).todos.push({ id: Date.now(), text, completed: false })
      ;(state as any).newTodoText = ''
    },
    removeTodo: ({ state, params }: MethodContext<any>) => {
      ;(state as any).todos = (state as any).todos.filter((todo: any) => todo.id !== (params as any).todoId)
    }
  }
}

export const shoppingCartExample: ExampleItem = {
  codeId: 'shopping-cart',
  titleKey: 'examples.shoppingCartApp',
  code: `{
  "type": "div",
  "props": { "class": "shopping-cart-demo", "style": "padding: 24px;" },
  "children": [
    { "type": "h2", "children": "商品商城" },
    {
      "type": "ElRow",
      "props": { "gutter": 20 },
      "children": [
        {
          "type": "ElCol",
          "loop": { "items": "{{ products }}", "itemKey": "product" },
          "props": { "span": 6 },
          "children": [
            {
              "type": "ElCard",
              "children": [
                { "type": "div", "children": "{{ product.name }}" },
                { "type": "div", "props": { "style": "color: #f56c6c; font-size: 20px;" }, "children": "¥{{ product.price }}" },
                {
                  "type": "ElButton",
                  "props": { "type": "primary" },
                  "events": { "click": [{ "type": "call", "method": "addToCart", "params": { "productId": "{{ product.id }}" } }] },
                  "children": "加入购物车"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}`,
  schema: null,
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: false,
  category: 'application'
}

export const searchFilterExample: ExampleItem = {
  codeId: 'search-filter',
  titleKey: 'examples.searchFilterApp',
  code: `{
  "type": "div",
  "props": { "class": "search-filter-demo", "style": "padding: 24px;" },
  "children": [
    { "type": "h2", "children": "搜索过滤示例" },
    {
      "type": "ElInput",
      "model": "searchQuery",
      "props": { "placeholder": "搜索商品名称...", "clearable": true }
    },
    {
      "type": "ElSelect",
      "model": "selectedCategory",
      "children": [
        { "type": "ElOption", "props": { "label": "全部", "value": "" } },
        { "type": "ElOption", "props": { "label": "电子产品", "value": "electronics" } }
      ]
    },
    {
      "type": "ElCard",
      "children": [
        {
          "type": "div",
          "loop": { "items": "{{ filteredItems }}", "itemKey": "item" },
          "children": [
            { "type": "div", "children": "{{ item.name }}" },
            { "type": "div", "children": "¥{{ item.price }}" }
          ]
        }
      ]
    }
  ]
}`,
  schema: null,
  icon: 'DocumentChecked',
  language: 'json',
  showPreview: false,
  category: 'application'
}
