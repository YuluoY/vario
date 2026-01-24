/**
 * Todo App 示例 - 使用 vario-vue Composition API
 */

import { useVario, type MethodContext } from '@variojs/vue'
import type { Schema } from '@variojs/schema'
import type { App } from 'vue'

interface TodoState extends Record<string, unknown> {
  todos: Array<{
    id: number
    text: string
    completed: boolean
  }>
  newTodoText: string
  filter: 'all' | 'active' | 'completed'
  completedCount?: number
  activeCount?: number
}

export function createTodoApp(app?: App | null) {
  const todoSchema: Schema<TodoState> = {
    type: 'div',
    props: {
      class: 'todo-app',
      style: 'padding: 20px; max-width: 600px; margin: 0 auto;'
    },
    children: [
      {
        type: 'div',
        children: [
          {
            type: 'h2',
            props: { style: 'margin: 0 0 8px 0; font-size: 24px; font-weight: 600;' },
            children: '我的待办事项'
          },
          {
            type: 'ElText',
            props: {
              type: 'info',
              style: 'display: block; margin-bottom: 20px;'
            },
            children: '使用 vario-vue Composition API 构建的 Todo 应用'
          }
        ]
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
            props: {
              placeholder: '请输入新的待办事项...',
              clearable: true,
              style: 'flex: 1;'
            },
            model: 'newTodoText',
            events: {
              keyup: [
                {
                  type: 'if',
                  cond: '{{ $event.key === "Enter" }}',
                  then: [
                    { type: 'call', method: 'addTodo' }
                  ]
                }
              ]
            }
          },
          {
            type: 'ElButton',
            props: {
              type: 'primary',
              icon: 'Plus'
            },
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
                    type: 'ElText',
                    props: {
                      style: '{{ todo.completed ? "text-decoration: line-through; color: #909399;" : "" }}',
                      class: '{{ todo.completed ? "todo-completed" : "" }}'
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
      },
      {
        type: 'ElCard',
        props: {
          shadow: 'never',
          style: 'margin-top: 20px;'
        },
        children: [
          {
            type: 'ElRow',
            props: { gutter: 20 },
            children: [
              {
                type: 'ElCol',
                props: { span: 8 },
                children: [
                  {
                    type: 'ElStatistic',
                    props: {
                      title: '总计',
                      value: '{{ todos.length }}'
                    }
                  }
                ]
              },
              {
                type: 'ElCol',
                props: { span: 8 },
                children: [
                  {
                    type: 'ElStatistic',
                    props: {
                      title: '已完成',
                      value: '{{ completedCount || 0 }}',
                      valueStyle: { color: '#3f8600' }
                    }
                  }
                ]
              },
              {
                type: 'ElCol',
                props: { span: 8 },
                children: [
                  {
                    type: 'ElStatistic',
                    props: {
                      title: '待完成',
                      value: '{{ activeCount || 0 }}',
                      valueStyle: { color: '#cf1322' }
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }

  const initialState: TodoState = {
    todos: [
      { id: 1, text: 'Learn Vario Schema', completed: true },
      { id: 2, text: 'Build a todo app', completed: false }
    ],
    newTodoText: '',
    filter: 'all'
  }

  const { vnode, state, ctx } = useVario(todoSchema, {
    app, // 传入 app 实例以获取全局组件
    state: initialState,
    computed: {
      completedCount: (state) => state.todos.filter(t => t.completed).length,
      activeCount: (state) => state.todos.filter(t => !t.completed).length
    },
    methods: {
      addTodo: ({ state }: MethodContext<TodoState>) => {
        const text = state.newTodoText?.trim()
        if (!text) return
        state.todos.push({ id: Date.now(), text, completed: false })
        state.newTodoText = ''
      },
      toggleTodo: ({ state, params }: MethodContext<TodoState>) => {
        const todo = state.todos.find(t => t.id === params.todoId)
        if (todo) todo.completed = !todo.completed
      },
      removeTodo: ({ state, params }: MethodContext<TodoState>) => {
        state.todos = state.todos.filter(todo => todo.id !== params.todoId)
      }
    },
    onError: (error: Error) => {
      console.error('[TodoApp] Error:', error)
    }
  })

  return {
    vnode,
    state,
    ctx
  }
}
