/**
 * Vue Integration Tests 示例
 * 用于 VueIntegrationTests.vue 组件的示例 schemas、states 和 methods
 */

import type { Schema } from '@variojs/schema'

// 各场景默认状态
export const defaultStates: Record<string, any> = {
  simpleForm: {
    name: '',
    message: '',
    submitted: false
  },
  counterApp: {
    counter: 0
  },
  todoList: {
    newTodo: '',
    todos: [
      { id: 1, text: 'Learn Vario', done: true },
      { id: 2, text: 'Build amazing apps', done: false },
      { id: 3, text: 'Ship to production', done: false }
    ]
  },
  conditionalUI: {
    showContent: false,
    userRole: 'guest'
  },
  dataGrid: {
    users: [
      { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
      { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'guest' }
    ]
  }
}

// Schema 示例（使用函数生成，以便在语言切换时重新计算）
export function getSchemas(): Record<string, Schema> {
  // 注意：这里需要在组件中调用，因为需要访问 i18n
  // 所以这个函数需要在组件中定义，但我们可以提供一个工厂函数
  return {}
}

// Methods 定义
export interface IntegrationMethods extends Record<string, (params: any) => any> {
  submitForm: (params: { state: any }) => void
  decrementCounter: (params: { state: any }) => void
  incrementCounter: (params: { state: any }) => void
  addTodo: (params: { state: any }) => void
  toggleTodo: (params: { state: any; params: { id: number } }) => void
  removeTodo: (params: { state: any; params: { id: number } }) => void
  addUser: (params: { state: any }) => void
}

// 创建 methods 工厂函数
export function createMethodsFactory(
  logEvent: (name: string, data?: any) => void
): IntegrationMethods {
  return {
    submitForm: ({ state }) => {
      if (!state.name?.trim() || !state.message?.trim()) return
      state.submitted = true
      logEvent('submit', { name: state.name, message: state.message })
    },
    decrementCounter: ({ state }) => { 
      state.counter = (state.counter ?? 0) - 1 
    },
    incrementCounter: ({ state }) => { 
      state.counter = (state.counter ?? 0) + 1 
    },
    addTodo: ({ state }) => {
      if (!state.newTodo?.trim()) return
      
      // 确保 todos 数组存在
      if (!Array.isArray(state.todos)) {
        state.todos = []
      }
      
      const nextId = (state.todos[state.todos.length - 1]?.id || 0) + 1
      state.todos.push({ id: nextId, text: state.newTodo, done: false })
      state.newTodo = ''
    },
    toggleTodo: ({ state, params }) => {
      if (!Array.isArray(state.todos)) return
      const todo = state.todos.find((t: any) => t.id === params?.id)
      if (todo) todo.done = !todo.done
    },
    removeTodo: ({ state, params }) => {
      if (!Array.isArray(state.todos)) return
      state.todos = state.todos.filter((t: any) => t.id !== params?.id)
    },
    addUser: ({ state }) => {
      const nextId = (state.users?.[state.users.length - 1]?.id || 0) + 1
      state.users.push({ 
        id: nextId, 
        name: `User ${nextId}`, 
        email: `user${nextId}@example.com`, 
        role: 'user' 
      })
    }
  }
}

// Computed 定义
export const integrationComputed = {
  todoCompleted: (s: any) => (s.todos?.filter((t: any) => t.done).length) || 0,
  totalUsers: (s: any) => (s.users?.length) || 0
}

// 工厂函数：创建 getSchemas 函数
export function createSchemasFactory(t: (key: string) => string): () => Record<string, Schema> {
  return (): Record<string, Schema> => ({
    simpleForm: {
      type: 'div',
      props: { style: 'padding: 20px;' },
      children: [
        { type: 'h3', children: t('vueIntegrationTests.simpleFormExample') },
        {
          type: 'ElInput',
          props: { placeholder: t('vueIntegrationTests.enterYourName'), style: 'margin-bottom: 10px;' },
          model: 'name'
        },
        {
          type: 'ElInput',
          props: { type: 'textarea', placeholder: t('vueIntegrationTests.enterYourMessage'), rows: 4 },
          model: 'message'
        },
        {
          type: 'ElButton',
          props: { type: 'primary', style: 'margin-top: 10px;' },
          events: {
            click: [{ type: 'call', method: 'submitForm' }]
          },
          children: t('vueIntegrationTests.submit')
        },
        {
          type: 'div',
          cond: '{{ submitted }}',
          props: { style: 'margin-top: 20px; padding: 10px; background: #f0f9ff;' },
          children: t('vueIntegrationTests.submitted').replace('{0}', '{{ name }}').replace('{1}', '{{ message }}')
        }
      ]
    },

    counterApp: {
      type: 'div',
      props: { style: 'padding: 20px; text-align: center;' },
      children: [
        { type: 'h3', children: t('vueIntegrationTests.counterExample') },
        {
          type: 'ElButton',
          props: { type: 'primary', circle: true, size: 'large' },
          events: {
            click: [{ type: 'call', method: 'decrementCounter' }]
          },
          children: '-'
        },
        {
          type: 'ElInputNumber',
          props: { size: 'large', style: 'margin: 0 20px;', min: -100, max: 100 },
          model: 'counter'
        },
        {
          type: 'ElButton',
          props: { type: 'primary', circle: true, size: 'large' },
          events: {
            click: [{ type: 'call', method: 'incrementCounter' }]
          },
          children: '+'
        },
        { type: 'p', props: { style: 'margin-top: 20px;' }, children: t('vueIntegrationTests.counterValue').replace('{0}', '{{ counter }}') },
        {
          type: 'el-tag',
          cond: '{{ counter > 10 }}',
          props: { type: 'danger', effect: 'dark' },
          children: t('vueIntegrationTests.counterIsHigh')
        }
      ]
    },

    todoList: {
      type: 'div',
      props: { style: 'padding: 20px;' },
      children: [
        { type: 'h3', children: t('vueIntegrationTests.todoListExample') },
        {
          type: 'div',
          props: { style: 'display: flex; gap: 10px; margin-bottom: 20px;' },
          children: [
            {
              type: 'ElInput',
              props: { placeholder: t('vueIntegrationTests.addNewTodo'), style: 'flex: 1;' },
              model: 'newTodo'
            },
            {
              type: 'ElButton',
              props: { type: 'primary' },
              events: { click: [{ type: 'call', method: 'addTodo' }] },
              children: t('vueIntegrationTests.add')
            }
          ]
        },
        {
          type: 'div',
          loop: { items: 'todos', itemKey: 'todo', indexKey: 'index' },
          props: { style: 'display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 8px; border: 1px solid #eee; border-radius: 4px;' },
          children: [
            {
              type: 'ElCheckbox',
              model: 'todo.done',
              events: {
                'update:modelValue': [
                  { type: 'call', method: 'toggleTodo', params: { id: '{{ todo.id }}' } }
                ]
              }
            },
            {
              type: 'span',
              props: { 
                style: '{{ todo.done ? "text-decoration: line-through; color: #999;" : "" }}'
              },
              children: '{{ todo.text }}'
            },
            {
              type: 'ElButton',
              props: { type: 'danger', size: 'small', text: true },
              events: {
                click: [{ type: 'call', method: 'removeTodo', params: { id: '{{ todo.id }}' } }]
              },
              children: t('vueIntegrationTests.delete')
            }
          ]
        },
        {
          type: 'p',
          cond: '{{ todos.length === 0 }}',
          props: { style: 'text-align: center; color: #999; padding: 40px;' },
          children: t('vueIntegrationTests.noTodosYet')
        }
      ]
    },

    conditionalUI: {
      type: 'div',
      props: { style: 'padding: 20px;' },
      children: [
        { type: 'h3', children: t('vueIntegrationTests.conditionalRenderingExample') },
        {
          type: 'div',
          props: { style: 'margin-bottom: 10px; display: flex; align-items: center; gap: 10px;' },
          children: [
            { type: 'span', children: t('vueIntegrationTests.toggleContent') },
            { type: 'ElSwitch', props: { 'active-text': t('vueIntegrationTests.show'), 'inactive-text': t('vueIntegrationTests.hide') }, model: 'showContent' }
          ]
        },
        {
          type: 'ElCard',
          show: '{{ showContent }}',
          props: { style: 'margin-top: 20px;' },
          children: [{ type: 'p', children: t('vueIntegrationTests.conditionalContent') }]
        },
        {
          type: 'div',
          props: { style: 'margin-top: 30px;' },
          children: [
            { type: 'p', props: { style: 'margin-bottom: 10px;' }, children: t('vueIntegrationTests.selectUserRole') },
            {
              type: 'ElSelect',
              props: { placeholder: t('vueIntegrationTests.selectUserRolePlaceholder'), style: 'width: 200px;' },
              model: 'userRole',
              children: [
                { type: 'ElOption', props: { label: t('vueIntegrationTests.admin'), value: 'admin' } },
                { type: 'ElOption', props: { label: t('vueIntegrationTests.user'), value: 'user' } },
                { type: 'ElOption', props: { label: t('vueIntegrationTests.guest'), value: 'guest' } }
              ]
            }
          ]
        },
        {
          type: 'ElAlert',
          cond: '{{ userRole === "admin" }}',
          props: { type: 'success', title: t('vueIntegrationTests.adminView'), style: 'margin-top: 20px;' },
          children: t('vueIntegrationTests.adminViewDescription')
        },
        {
          type: 'ElAlert',
          cond: '{{ userRole === "user" }}',
          props: { type: 'info', title: t('vueIntegrationTests.userView'), style: 'margin-top: 20px;' },
          children: t('vueIntegrationTests.userViewDescription')
        },
        {
          type: 'ElAlert',
          cond: '{{ userRole === "guest" }}',
          props: { type: 'warning', title: t('vueIntegrationTests.guestView'), style: 'margin-top: 20px;' },
          children: t('vueIntegrationTests.guestViewDescription')
        }
      ]
    },

    dataGrid: {
      type: 'div',
      props: { style: 'padding: 20px;' },
      children: [
        { type: 'h3', children: t('vueIntegrationTests.dataGridExample') },
        {
          type: 'ElTable',
          props: { data: '{{ users }}', border: true, stripe: true },
          children: [
            { type: 'ElTableColumn', props: { prop: 'id', label: t('vueIntegrationTests.id'), width: '80' } },
            { type: 'ElTableColumn', props: { prop: 'name', label: t('vueIntegrationTests.name'), width: '150' } },
            { type: 'ElTableColumn', props: { prop: 'email', label: t('vueIntegrationTests.email') } },
            { type: 'ElTableColumn', props: { prop: 'role', label: t('vueIntegrationTests.role'), width: '120' } }
          ]
        },
        {
          type: 'ElButton',
          props: { type: 'primary', style: 'margin-top: 20px;' },
          events: {
            click: [{ type: 'call', method: 'addUser' }]
          },
          children: t('vueIntegrationTests.addUser')
        }
      ]
    }
  })
}
