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

  describe('model 作用域 (scope)', () => {
    it('model: { path, scope: true } 时仅作作用域不绑定本节点', async () => {
      const schema: VueSchemaNode = {
        type: 'form',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: 'name' },
          { type: 'input', model: 'age' }
        ]
      }

      const { state, vnode } = useVario(schema, { state: {} })
      await nextTick()

      const nameInput = (vnode.value as any)?.children?.[0]
      const ageInput = (vnode.value as any)?.children?.[1]
      if (nameInput?.props?.onInput) nameInput.props.onInput('Alice')
      else if (nameInput?.props?.['onUpdate:modelValue']) nameInput.props['onUpdate:modelValue']('Alice')
      if (ageInput?.props?.onInput) ageInput.props.onInput('28')
      else if (ageInput?.props?.['onUpdate:modelValue']) ageInput.props['onUpdate:modelValue']('28')
      await nextTick()

      expect(state.form).toBeDefined()
      expect(state.form.name).toBe('Alice')
      expect(state.form.age).toBe('28')
    })

    it('多级 scope 时子路径正确拼接', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          {
            type: 'div',
            model: { path: 'addr', scope: true },
            children: [
              { type: 'input', model: 'city' },
              { type: 'input', model: 'street' }
            ]
          }
        ]
      }

      const { state, vnode } = useVario(schema, { state: {} })
      await nextTick()

      const innerDiv = (vnode.value as any)?.children?.[0]
      const cityInput = innerDiv?.children?.[0]
      if (cityInput?.props?.onInput) cityInput.props.onInput('Beijing')
      else if (cityInput?.props?.['onUpdate:modelValue']) cityInput.props['onUpdate:modelValue']('Beijing')
      await nextTick()

      expect(state.form?.addr?.city).toBe('Beijing')
    })

    it('model: "." 时绑定到当前路径栈（循环中即数组元素本身 items[0]/items[1]）', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        loop: { items: 'items', itemKey: 'i' },
        model: { path: 'items', scope: true },
        children: [{ type: 'input', model: '.' }]
      }

      const { state, vnode } = useVario(schema, { state: { items: ['', ''] } })
      await nextTick()

      const row0 = (vnode.value as any)?.children?.[0]
      const input0 = row0?.children?.[0]
      if (input0?.props?.onInput) {
        input0.props.onInput('first')
      } else if (input0?.props?.['onUpdate:modelValue']) {
        input0.props['onUpdate:modelValue']('first')
      }
      await nextTick()
      expect(state.items[0]).toBe('first')
      expect(state.items[1]).toBe('')

      const row1 = (vnode.value as any)?.children?.[1]
      const input1 = row1?.children?.[0]
      if (input1?.props?.onInput) {
        input1.props.onInput('second')
      } else if (input1?.props?.['onUpdate:modelValue']) {
        input1.props['onUpdate:modelValue']('second')
      }
      await nextTick()
      expect(state.items[1]).toBe('second')
      expect(state.items).toEqual(['first', 'second'])
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
    it('应该支持 modelOptions 配置（如 separator）', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          {
            type: 'input',
            model: 'name'
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {},
        modelOptions: { separator: '.' }
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

      expect(state.form).toBeDefined()
      expect(state.form.name).toBe('Test')
    })

    it('modelOptions.lazy: true 时所有未显式 lazy 的 model 不预写 state', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: 'name' },
          { type: 'input', model: { path: 'optional', lazy: true } }
        ]
      }
      const { state, vnode } = useVario(schema, { state: {}, modelOptions: { lazy: true } })
      await nextTick()
      expect(state.form).toBeUndefined()
      const nameInput = (vnode.value as any)?.children?.[0]
      if (nameInput?.props?.onInput) nameInput.props.onInput('a')
      else if (nameInput?.props?.['onUpdate:modelValue']) nameInput.props['onUpdate:modelValue']('a')
      await nextTick()
      expect(state.form?.name).toBe('a')
    })

    it('modelOptions.lazy: true 时节点 lazy: false 可覆盖为预写', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: { path: 'required', lazy: false } }
        ]
      }
      const { state } = useVario(schema, { state: {}, modelOptions: { lazy: true } })
      await nextTick()
      expect(state.form).toBeDefined()
      expect(state.form.required).toBe('')
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
