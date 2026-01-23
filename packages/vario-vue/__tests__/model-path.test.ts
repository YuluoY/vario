/**
 * Model 路径自动解析测试
 * 
 * 测试：
 * - 扁平路径自动拼接
 * - 明确路径直接使用
 * - 层级路径栈维护
 * - state 自动创建
 */

import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { useVario } from '../src/composable.js'
import type { VueSchemaNode } from '../src/types.js'

describe('Model 路径自动解析', () => {
  describe('扁平路径自动拼接', () => {
    it('应该自动拼接父级 model 路径', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',  // 父级定义
        children: [
          {
            type: 'input',
            model: 'name'  // 扁平路径，应该自动变成 form.name
          },
          {
            type: 'input',
            model: 'age'  // 扁平路径，应该自动变成 form.age
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}  // 空 state，应该自动创建
      })

      await nextTick()

      // 通过双向绑定设置值来触发 state 创建
      const inputVNode = (vnode.value as any)?.children?.[0]
      if (inputVNode?.props?.onInput) {
        inputVNode.props.onInput('Test Name')
      } else if (inputVNode?.props?.['onUpdate:modelValue']) {
        inputVNode.props['onUpdate:modelValue']('Test Name')
      }

      await nextTick()

      // 验证 state 结构已自动创建
      expect(state.form).toBeDefined()
      expect(typeof state.form).toBe('object')
      expect(state.form.name).toBe('Test Name')
    })

    it('应该支持多层嵌套', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',  // 顶层
        children: [
          {
            type: 'div',
            model: 'user',  // 相对于 form，变成 form.user
            children: [
              {
                type: 'input',
                model: 'name'  // 扁平路径，应该自动变成 form.user.name
              },
              {
                type: 'input',
                model: 'age'  // 扁平路径，应该自动变成 form.user.age
              }
            ]
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      // 通过双向绑定设置值
      const userDiv = (vnode.value as any)?.children?.[0]
      const nameInput = userDiv?.children?.[0]
      if (nameInput?.props?.onInput) {
        nameInput.props.onInput('John')
      } else if (nameInput?.props?.['onUpdate:modelValue']) {
        nameInput.props['onUpdate:modelValue']('John')
      }

      await nextTick()

      expect(state.form).toBeDefined()
      expect(state.form.user).toBeDefined()
      expect(typeof state.form.user).toBe('object')
      expect(state.form.user.name).toBe('John')
    })
  })

  describe('明确路径', () => {
    it('应该直接使用明确路径，不受父级影响', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',  // 父级定义
        children: [
          {
            type: 'input',
            model: 'form.user.phone'  // 明确路径，直接使用
          },
          {
            type: 'input',
            model: 'email'  // 扁平路径，应该自动变成 form.email
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      // 设置值触发 state 创建
      const phoneInput = (vnode.value as any)?.children?.[0]
      const emailInput = (vnode.value as any)?.children?.[1]
      
      if (phoneInput?.props?.onInput) {
        phoneInput.props.onInput('123456')
      } else if (phoneInput?.props?.['onUpdate:modelValue']) {
        phoneInput.props['onUpdate:modelValue']('123456')
      }

      if (emailInput?.props?.onInput) {
        emailInput.props.onInput('test@example.com')
      } else if (emailInput?.props?.['onUpdate:modelValue']) {
        emailInput.props['onUpdate:modelValue']('test@example.com')
      }

      await nextTick()

      expect(state.form).toBeDefined()
      expect(state.form.user).toBeDefined()
      expect(state.form.user.phone).toBe('123456')
      expect(state.form.email).toBe('test@example.com')
    })
  })

  describe('配置选项', () => {
    it('应该支持禁用自动解析', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',
        children: [
          {
            type: 'input',
            model: 'name'  // 禁用后，应该保持为 name（顶层）
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {},
        modelPath: false  // 禁用自动解析
      })

      await nextTick()

      // 设置值
      const nameInput = (vnode.value as any)?.children?.[0]
      if (nameInput?.props?.onInput) {
        nameInput.props.onInput('Test')
      } else if (nameInput?.props?.['onUpdate:modelValue']) {
        nameInput.props['onUpdate:modelValue']('Test')
      }

      await nextTick()

      // 禁用后，name 应该是顶层，form 不会影响它
      expect(state.name).toBe('Test')  // 顶层 name
      expect(state.form).toBeUndefined()  // form 没有设置值
    })

    it('应该支持自定义分隔符', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',
        children: [
          {
            type: 'input',
            model: 'name'  // 使用 / 分隔符解析，但 state 仍使用 . 结构
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {},
        modelPath: {
          autoResolve: true,
          separator: '/'  // 自定义分隔符（用于路径解析）
        }
      })

      await nextTick()

      // 设置值
      const nameInput = (vnode.value as any)?.children?.[0]
      if (nameInput?.props?.onInput) {
        nameInput.props.onInput('Test')
      } else if (nameInput?.props?.['onUpdate:modelValue']) {
        nameInput.props['onUpdate:modelValue']('Test')
      }

      await nextTick()

      // 注意：虽然路径解析使用 /，但 state 结构仍然使用 .（因为 setPathValue 内部使用 .）
      // 这里主要验证不会报错，实际路径解析逻辑正确
      expect(state.form).toBeDefined()
      expect(state.form.name).toBe('Test')
    })
  })

  describe('state 自动创建', () => {
    it('应该自动创建缺失的对象结构', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',
        children: [
          {
            type: 'div',
            model: 'user',
            children: [
              {
                type: 'input',
                model: 'name'
              }
            ]
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}  // 完全空的 state
      })

      await nextTick()

      // 通过双向绑定设置值来触发 state 创建
      const userDiv = (vnode.value as any)?.children?.[0]
      const nameInput = userDiv?.children?.[0]
      if (nameInput?.props?.onInput) {
        nameInput.props.onInput('John')
      } else if (nameInput?.props?.['onUpdate:modelValue']) {
        nameInput.props['onUpdate:modelValue']('John')
      }

      await nextTick()

      // 验证结构已自动创建
      expect(state.form).toBeDefined()
      expect(state.form.user).toBeDefined()
      expect(typeof state.form.user).toBe('object')
      expect(state.form.user.name).toBe('John')
    })

    it('应该支持部分预定义 state', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',
        children: [
          {
            type: 'input',
            model: 'name'
          },
          {
            type: 'input',
            model: 'age'
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {
          form: {
            name: 'John'  // 部分预定义
          }
        }
      })

      await nextTick()

      expect(state.form.name).toBe('John')
      
      // 设置 age 值来触发自动创建
      const ageInput = (vnode.value as any)?.children?.[1]
      if (ageInput?.props?.onInput) {
        ageInput.props.onInput(30)
      } else if (ageInput?.props?.['onUpdate:modelValue']) {
        ageInput.props['onUpdate:modelValue'](30)
      }

      await nextTick()

      expect(state.form.age).toBe(30)  // 应该自动创建并设置值
    })
  })

  describe('混合使用', () => {
    it('应该支持顶层扁平路径和嵌套路径混合', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        children: [
          {
            type: 'input',
            model: 'username'  // 顶层扁平路径
          },
          {
            type: 'div',
            model: 'form',
            children: [
              {
                type: 'input',
                model: 'email'  // 嵌套扁平路径，变成 form.email
              }
            ]
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      // 设置值
      const usernameInput = (vnode.value as any)?.children?.[0]
      const formDiv = (vnode.value as any)?.children?.[1]
      const emailInput = formDiv?.children?.[0]

      if (usernameInput?.props?.onInput) {
        usernameInput.props.onInput('john_doe')
      } else if (usernameInput?.props?.['onUpdate:modelValue']) {
        usernameInput.props['onUpdate:modelValue']('john_doe')
      }

      if (emailInput?.props?.onInput) {
        emailInput.props.onInput('john@example.com')
      } else if (emailInput?.props?.['onUpdate:modelValue']) {
        emailInput.props['onUpdate:modelValue']('john@example.com')
      }

      await nextTick()

      expect(state.username).toBe('john_doe')
      expect(state.form).toBeDefined()
      expect(state.form.email).toBe('john@example.com')
    })
  })
})
