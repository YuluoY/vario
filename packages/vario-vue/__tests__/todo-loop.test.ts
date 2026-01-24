/**
 * TodoList 循环渲染完整测试
 * 验证循环中的 model 绑定、事件处理、添加和删除功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { h } from 'vue'
import { VueRenderer } from '../src/renderer'
import type { Schema } from '@variojs/schema'
import { createRuntimeContext } from '@variojs/core'
import type { RuntimeContext } from '@variojs/core'

describe('TodoList 循环渲染完整测试', () => {
  let renderer: VueRenderer
  let ctx: RuntimeContext
  let state: {
    newTodo: string
    todos: Array<{ id: number; text: string; done: boolean }>
  }

  beforeEach(() => {
    state = {
      newTodo: '',
      todos: [
        { id: 1, text: 'Learn Vario', done: true },
        { id: 2, text: 'Build apps', done: false },
        { id: 3, text: 'Ship to production', done: false }
      ]
    }

    // 所有操作都通过 ctx 完成
    const methods = {
      addTodo: async (methodCtx: RuntimeContext) => {
        const newTodo = methodCtx._get('newTodo') as string
        if (!newTodo?.trim()) return
        const todos = (methodCtx._get('todos') as any[]) || []
        const nextId = (todos[todos.length - 1]?.id || 0) + 1
        methodCtx._set('todos', [...todos, { id: nextId, text: newTodo, done: false }])
        methodCtx._set('newTodo', '')
      },
      toggleTodo: async (methodCtx: RuntimeContext, params: any) => {
        const todos = (methodCtx._get('todos') as any[]) || []
        const newTodos = todos.map((t: any) => 
          t.id === params?.id ? { ...t, done: !t.done } : t
        )
        methodCtx._set('todos', newTodos)
      },
      removeTodo: async (methodCtx: RuntimeContext, params: any) => {
        const todos = (methodCtx._get('todos') as any[]) || []
        methodCtx._set('todos', todos.filter((t: any) => t.id !== params?.id))
      }
    }

    ctx = createRuntimeContext(state, { methods })

    renderer = new VueRenderer({
      getState: () => ctx as any  // 使用 ctx 作为状态源
    })
  })
  
  // 辅助函数：获取 todos
  const getTodos = () => ctx._get('todos') as any[]

  describe('基础渲染', () => {
    it('应该正确渲染 todos 列表', () => {
      const schema: Schema = {
        type: 'div',
        loop: { items: 'todos', itemKey: 'todo', indexKey: 'index' },
        children: [
          {
            type: 'ElCheckbox',
            model: 'todo.done'
          },
          {
            type: 'span',
            children: '{{ todo.text }}'
          }
        ]
      }

      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      
      // 检查是否渲染了 3 个 todo 项
      expect(Array.isArray(vnode?.children)).toBe(true)
      expect((vnode?.children as any[]).length).toBe(3)
      
      // 检查第一个 todo 的 checkbox 状态
      const firstItem = (vnode?.children as any[])[0]
      const checkbox = firstItem.children?.[0]
      expect(checkbox?.props?.modelValue).toBe(true) // 第一个 todo done: true
      
      // 检查第一个 todo 的文本
      const span = firstItem.children?.[1]
      expect(span?.children).toBe('Learn Vario')
    })

    it('应该正确解析 model 路径', () => {
      // 模拟循环上下文
      const loopCtx = createRuntimeContext({ ...state }, {})
      ;(loopCtx as any).todo = getTodos()[0]
      ;(loopCtx as any).$item = getTodos()[0]
      ;(loopCtx as any).$index = 0

      const schema: Schema = {
        type: 'ElCheckbox',
        model: 'todo.done'
      } as any
      ;(schema as any).__loopItems = 'todos'

      const modelPath = (renderer as any).pathResolver.resolveModelPath('todo.done', schema, loopCtx)
      expect(modelPath).toBe('todos.0.done')
    })
  })

  describe('添加功能', () => {
    it('应该能够添加新的 todo', async () => {
      const schema: Schema = {
        type: 'div',
        children: [
          {
            type: 'ElInput',
            model: 'newTodo'
          },
          {
            type: 'ElButton',
            events: {
              click: [{ type: 'call', method: 'addTodo' }]
            },
            children: 'Add'
          },
          {
            type: 'div',
            loop: { items: 'todos', itemKey: 'todo' },
            children: [
              {
                type: 'span',
                children: '{{ todo.text }}'
              }
            ]
          }
        ]
      }

      // 初始渲染
      const vnode = renderer.render(schema, ctx)
      expect(vnode).not.toBeNull()
      
      // 设置 newTodo
      ctx._set('newTodo', 'New Task')
      expect(ctx._get('newTodo')).toBe('New Task')
      
      // 触发添加按钮点击
      const button = (vnode?.children as any[])?.[1]
      const onClick = button?.props?.onClick
      expect(onClick).toBeDefined()
      
      await onClick?.(new Event('click'))
      
      // 验证 todo 已添加
      expect(getTodos().length).toBe(4)
      expect(getTodos()[3].text).toBe('New Task')
      expect(getTodos()[3].done).toBe(false)
      expect(ctx._get('newTodo')).toBe('') // 应该被清空
      
      // 重新渲染验证新 todo 显示
      const newVnode = renderer.render(schema, ctx)
      expect((newVnode?.children as any[])?.[2]?.children?.length).toBe(4)
    })

    it('添加空 todo 应该被忽略', async () => {
      const schema: Schema = {
        type: 'div',
        children: [
          {
            type: 'ElInput',
            model: 'newTodo'
          },
          {
            type: 'ElButton',
            events: {
              click: [{ type: 'call', method: 'addTodo' }]
            },
            children: 'Add'
          }
        ]
      }

      const initialCount = getTodos().length
      
      // 设置空字符串
      ctx._set('newTodo', '   ')
      
      const vnode = renderer.render(schema, ctx)
      const button = (vnode?.children as any[])?.[1]
      const onClick = button?.props?.onClick
      
      await onClick?.(new Event('click'))
      
      // 应该没有添加
      expect(getTodos().length).toBe(initialCount)
    })
  })

  describe('删除功能', () => {
    it('应该能够删除指定的 todo', async () => {
      const schema: Schema = {
        type: 'div',
        loop: { items: 'todos', itemKey: 'todo' },
        children: [
          {
            type: 'span',
            children: '{{ todo.text }}'
          },
          {
            type: 'ElButton',
            events: {
              click: [{ type: 'call', method: 'removeTodo', params: { id: '{{ todo.id }}' } }]
            },
            children: 'Delete'
          }
        ]
      }

      const initialCount = getTodos().length
      expect(initialCount).toBe(3)
      
      // 渲染获取第一个删除按钮
      const vnode = renderer.render(schema, ctx)
      const firstItem = (vnode?.children as any[])?.[0]
      const deleteButton = firstItem?.children?.[1]
      const onClick = deleteButton?.props?.onClick
      
      expect(onClick).toBeDefined()
      
      // 触发删除（删除第一个 todo，id=1）
      await onClick?.(new Event('click'))
      
      // 验证 todo 已删除
      expect(getTodos().length).toBe(2)
      expect(getTodos().find((t: any) => t.id === 1)).toBeUndefined()
      expect(getTodos()[0].id).toBe(2) // 原来的第二个现在是第一个
    })

    it('删除后应该正确重新渲染', async () => {
      const schema: Schema = {
        type: 'div',
        loop: { items: 'todos', itemKey: 'todo' },
        children: [
          {
            type: 'span',
            children: '{{ todo.text }}'
          },
          {
            type: 'ElButton',
            events: {
              click: [{ type: 'call', method: 'removeTodo', params: { id: '{{ todo.id }}' } }]
            },
            children: 'Delete'
          }
        ]
      }

      // 删除第二个 todo (id=2)
      const vnode = renderer.render(schema, ctx)
      const secondItem = (vnode?.children as any[])?.[1]
      const deleteButton = secondItem?.children?.[1]
      const onClick = deleteButton?.props?.onClick
      
      await onClick?.(new Event('click'))
      
      // 重新渲染
      const newVnode = renderer.render(schema, ctx)
      
      // 应该只有 2 个 todo
      expect((newVnode?.children as any[]).length).toBe(2)
      
      // 验证文本内容
      const firstItem = (newVnode?.children as any[])?.[0]
      const secondItemNew = (newVnode?.children as any[])?.[1]
      expect(firstItem?.children?.[0]?.children).toBe('Learn Vario')
      expect(secondItemNew?.children?.[0]?.children).toBe('Ship to production')
    })
  })

  describe('切换功能', () => {
    it('应该能够切换 todo 的完成状态', async () => {
      const schema: Schema = {
        type: 'div',
        loop: { items: 'todos', itemKey: 'todo' },
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
            children: '{{ todo.text }}'
          }
        ]
      }

      // 初始状态：第二个 todo done: false
      expect(getTodos()[1].done).toBe(false)
      
      const vnode = renderer.render(schema, ctx)
      const secondItem = (vnode?.children as any[])?.[1]
      const checkbox = secondItem?.children?.[0]
      
      // 验证初始 checkbox 状态
      expect(checkbox?.props?.modelValue).toBe(false)
      
      // 触发 update:modelValue 事件
      const onUpdate = checkbox?.props?.['onUpdate:modelValue']
      expect(onUpdate).toBeDefined()
      
      // 模拟用户点击，切换为 true
      await onUpdate?.(true)
      
      // 验证状态已切换
      expect(getTodos()[1].done).toBe(true)
      
      // 再次切换
      await onUpdate?.(false)
      expect(getTodos()[1].done).toBe(false)
    })

    it('切换状态后应该正确更新渲染', async () => {
      const schema: Schema = {
        type: 'div',
        loop: { items: 'todos', itemKey: 'todo' },
        children: [
          {
            type: 'ElCheckbox',
            model: 'todo.done',
            events: {
              'update:modelValue': [
                { type: 'call', method: 'toggleTodo', params: { id: '{{ todo.id }}' } }
              ]
            }
          }
        ]
      }

      // 切换第一个 todo
      const vnode = renderer.render(schema, ctx)
      const firstItem = (vnode?.children as any[])?.[0]
      const checkbox = firstItem?.children?.[0]
      const onUpdate = checkbox?.props?.['onUpdate:modelValue']
      
      // 从 true 切换为 false
      expect(getTodos()[0].done).toBe(true)
      await onUpdate?.(false)
      expect(getTodos()[0].done).toBe(false)
      
      // 重新渲染验证
      const newVnode = renderer.render(schema, ctx)
      const newFirstItem = (newVnode?.children as any[])?.[0]
      const newCheckbox = newFirstItem?.children?.[0]
      expect(newCheckbox?.props?.modelValue).toBe(false)
    })
  })

  describe('完整流程测试', () => {
    it('应该能够完成完整的 todo 操作流程', async () => {
      const schema: Schema = {
        type: 'div',
        children: [
          {
            type: 'ElInput',
            model: 'newTodo',
            props: { placeholder: 'Add new todo' }
          },
          {
            type: 'ElButton',
            events: {
              click: [{ type: 'call', method: 'addTodo' }]
            },
            children: 'Add'
          },
          {
            type: 'div',
            loop: { items: 'todos', itemKey: 'todo' },
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
                  style: '{{ todo.done ? "text-decoration: line-through;" : "" }}'
                },
                children: '{{ todo.text }}'
              },
              {
                type: 'ElButton',
                events: {
                  click: [{ type: 'call', method: 'removeTodo', params: { id: '{{ todo.id }}' } }]
                },
                children: 'Delete'
              }
            ]
          }
        ]
      }

      // 1. 初始状态：3 个 todo
      let vnode = renderer.render(schema, ctx)
      let todoList = (vnode?.children as any[])?.[2]?.children
      expect(todoList?.length).toBe(3)

      // 2. 添加新 todo
      ctx._set('newTodo', 'Complete workflow test')
      vnode = renderer.render(schema, ctx)
      const addButton = (vnode?.children as any[])?.[1]
      await addButton?.props?.onClick?.(new Event('click'))
      expect(getTodos().length).toBe(4)
      expect(getTodos()[3].text).toBe('Complete workflow test')

      // 3. 切换新添加的 todo 状态
      vnode = renderer.render(schema, ctx)
      todoList = (vnode?.children as any[])?.[2]?.children
      const newTodoItem = todoList?.[3]
      const newTodoCheckbox = newTodoItem?.children?.[0]
      await newTodoCheckbox?.props?.['onUpdate:modelValue']?.(true)
      expect(getTodos()[3].done).toBe(true)

      // 4. 删除第二个 todo (id=2)
      const secondTodoItem = todoList?.[1]
      const deleteButton = secondTodoItem?.children?.[2]
      await deleteButton?.props?.onClick?.(new Event('click'))
      expect(getTodos().length).toBe(3)
      expect(getTodos().find((t: any) => t.id === 2)).toBeUndefined()

      // 5. 验证最终状态
      vnode = renderer.render(schema, ctx)
      todoList = (vnode?.children as any[])?.[2]?.children
      expect(todoList?.length).toBe(3)
      
      // 验证剩余 todo 的文本
      expect(todoList?.[0]?.children?.[1]?.children).toBe('Learn Vario')
      expect(todoList?.[1]?.children?.[1]?.children).toBe('Ship to production')
      expect(todoList?.[2]?.children?.[1]?.children).toBe('Complete workflow test')
      
      // 验证新 todo 的状态
      expect(todoList?.[2]?.children?.[0]?.props?.modelValue).toBe(true)
    })

    it('应该正确处理多个快速操作', async () => {
      const schema: Schema = {
        type: 'div',
        children: [
          {
            type: 'ElInput',
            model: 'newTodo'
          },
          {
            type: 'ElButton',
            events: {
              click: [{ type: 'call', method: 'addTodo' }]
            },
            children: 'Add'
          },
          {
            type: 'div',
            loop: { items: 'todos', itemKey: 'todo' },
            children: [
              {
                type: 'ElButton',
                events: {
                  click: [{ type: 'call', method: 'removeTodo', params: { id: '{{ todo.id }}' } }]
                },
                children: 'Delete'
              }
            ]
          }
        ]
      }

      // 快速添加 3 个 todo
      for (let i = 0; i < 3; i++) {
        ctx._set('newTodo', `Quick todo ${i + 1}`)
        const vnode = renderer.render(schema, ctx)
        const addButton = (vnode?.children as any[])?.[1]
        await addButton?.props?.onClick?.(new Event('click'))
      }

      expect(getTodos().length).toBe(6)

      // 快速删除前 3 个
      for (let i = 0; i < 3; i++) {
        const vnode = renderer.render(schema, ctx)
        const todoList = (vnode?.children as any[])?.[2]?.children
        const deleteButton = todoList?.[0]?.children?.[0]
        await deleteButton?.props?.onClick?.(new Event('click'))
      }

      expect(getTodos().length).toBe(3)
      // 应该剩下后添加的 3 个（删除的是 id 最小的前3个）
      expect(getTodos()[0].text).toBe('Quick todo 1')
      expect(getTodos()[1].text).toBe('Quick todo 2')
      expect(getTodos()[2].text).toBe('Quick todo 3')
    })
  })

  describe('边界情况', () => {
    it('空列表应该正确渲染', () => {
      ctx._set('todos', [])
      
      const schema: Schema = {
        type: 'div',
        loop: { items: 'todos', itemKey: 'todo' },
        children: [
          {
            type: 'span',
            children: '{{ todo.text }}'
          }
        ]
      }

      const vnode = renderer.render(schema, ctx)
      // 空数组时 loop 返回 null，render 包装成空 Fragment
      // 检查返回的是空的 Fragment（children 为空数组）
      expect(vnode).not.toBeNull()
      expect(Array.isArray(vnode?.children)).toBe(true)
      expect((vnode?.children as any[]).length).toBe(0)
    })

    it('删除所有 todo 后应该为空', async () => {
      const schema: Schema = {
        type: 'div',
        loop: { items: 'todos', itemKey: 'todo' },
        children: [
          {
            type: 'ElButton',
            events: {
              click: [{ type: 'call', method: 'removeTodo', params: { id: '{{ todo.id }}' } }]
            },
            children: 'Delete'
          }
        ]
      }

      // 删除所有 todo
      const maxIterations = 10 // 防止无限循环
      let iterations = 0
      while (getTodos().length > 0 && iterations < maxIterations) {
        const vnode = renderer.render(schema, ctx)
        if (!vnode?.children || !Array.isArray(vnode.children) || vnode.children.length === 0) {
          break
        }
        const firstItem = (vnode.children as any[])[0]
        const deleteButton = firstItem?.children?.[0]
        if (!deleteButton?.props?.onClick) {
          break
        }
        await deleteButton.props.onClick(new Event('click'))
        iterations++
      }

      expect(getTodos().length).toBe(0)
      
      // 重新渲染应该返回空 Fragment
      const finalVnode = renderer.render(schema, ctx)
      expect(finalVnode).not.toBeNull()
      expect(Array.isArray(finalVnode?.children)).toBe(true)
      expect((finalVnode?.children as any[]).length).toBe(0)
    })
  })
})
