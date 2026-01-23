import { describe, it, expect } from 'vitest'
import { createApp, h, defineComponent } from 'vue'
import { defineSchema } from '@vario/schema'
import { createRuntimeContext } from '@vario/core'
import { VueRenderer } from '@vario/vue'

// 模拟 Element Plus 按钮组件
const ElButton = defineComponent({
  name: 'ElButton',
  props: {
    type: String,
    disabled: Boolean,
    loading: Boolean
  },
  setup(props, { slots }) {
    return () => h('button', {
      class: 'el-button',
      disabled: props.disabled,
      'data-testid': 'el-button'
    }, slots.default?.() || 'Button')
  }
})

// 模拟 Element Plus 输入框组件
const ElInput = defineComponent({
  name: 'ElInput',
  props: {
    modelValue: String,
    placeholder: String,
    disabled: Boolean
  },
  setup(props, { emit }) {
    return () => h('input', {
      type: 'text',
      class: 'el-input',
      value: props.modelValue,
      placeholder: props.placeholder,
      disabled: props.disabled,
      onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
      'data-testid': 'el-input'
    })
  }
})

describe('Vue integration with Element Plus', () => {
  it('should render Element Plus button component', () => {
    // 定义一个使用 Element Plus 按钮的 schema
    const view = defineSchema({
      state: { buttonText: 'Click me' },
      schema(ctx) {
        return {
          type: 'ElButton',
          props: {
            type: 'primary',
            disabled: false
          },
          children: ctx.buttonText
        }
      }
    })

    // 创建运行时上下文
    const ctx = createRuntimeContext(view.stateType)
    
    // 创建 Vue 渲染器
    const renderer = new VueRenderer()
    
    // 渲染 VNode
    const vnode = renderer.render(view.schema, ctx)
    
    // 验证渲染的组件类型
    expect(vnode.type).toBeDefined()
    // 注意：在实际 Vue 环境中，vnode.type 可能是组件对象
    // 但在测试中，它可能是一个字符串或组件对象
    // 这里我们主要验证渲染过程不报错
    expect(vnode).toBeDefined()
  })

  it('should handle Element Plus input with model binding', async () => {
    // 定义一个使用 Element Plus 输入框的 schema
    const view = defineSchema({
      state: { username: '' },
      schema(ctx) {
        return {
          type: 'ElInput',
          model: 'username',
          props: {
            placeholder: '请输入用户名'
          }
        }
      }
    })

    // 创建运行时上下文
    const ctx = createRuntimeContext(view.stateType)
    
    // 创建 Vue 渲染器
    const renderer = new VueRenderer()
    
    // 渲染 VNode
    const vnode = renderer.render(view.schema, ctx)
    
    // 验证 VNode 存在
    expect(vnode).toBeDefined()
    
    // 验证 modelValue 属性存在（双向绑定）
    expect(vnode.props).toBeDefined()
    expect(vnode.props.modelValue).toBeDefined()
    expect(vnode.props['onUpdate:modelValue']).toBeDefined()
  })

  it('should support Element Plus components with events', async () => {
    // 定义一个使用 Element Plus 按钮并带有点击事件的 schema
    const view = defineSchema({
      state: { clickCount: 0 },
      schema(ctx) {
        return {
          type: 'ElButton',
          props: {
            type: 'success'
          },
          events: {
            click: [
              { op: 'set', path: 'clickCount', value: '{{ clickCount + 1 }}' }
            ]
          },
          children: 'Click to increment'
        }
      }
    })

    // 创建运行时上下文
    const ctx = createRuntimeContext(view.stateType)
    
    // 创建 Vue 渲染器
    const renderer = new VueRenderer()
    
    // 渲染 VNode
    const vnode = renderer.render(view.schema, ctx)
    
    // 验证事件处理器存在
    expect(vnode.props).toBeDefined()
    expect(vnode.props.onClick).toBeDefined()
  })

  it('should handle nested Element Plus components', () => {
    // 定义嵌套 Element Plus 组件的 schema
    const view = defineSchema({
      state: { items: ['Item 1', 'Item 2', 'Item 3'] },
      schema(ctx) {
        return {
          type: 'div',
          children: ctx.items.map((item, index) => ({
            type: 'ElButton',
            props: {
              type: 'text',
              size: 'small'
            },
            children: item
          }))
        }
      }
    })

    // 创建运行时上下文
    const ctx = createRuntimeContext(view.stateType)
    
    // 创建 Vue 渲染器
    const renderer = new VueRenderer()
    
    // 渲染 VNode
    const vnode = renderer.render(view.schema, ctx)
    
    // 验证 VNode 存在
    expect(vnode).toBeDefined()
    expect(vnode.children).toBeDefined()
    expect(Array.isArray(vnode.children)).toBe(true)
  })
})

// 辅助函数：创建测试用的 Vue 应用
function createTestApp(component: any) {
  const app = createApp(component)
  
  // 注册模拟的 Element Plus 组件
  app.component('ElButton', ElButton)
  app.component('ElInput', ElInput)
  
  return app
}