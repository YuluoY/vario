/**
 * Model 路径自动解析 - 全面测试
 * 
 * 测试覆盖：
 * 1. 循环中的 model 路径处理
 * 2. 明确路径不受层级影响
 * 3. 扁平路径自动拼接
 * 4. 多层嵌套
 * 5. 混合使用场景
 * 6. 配置选项（启用/禁用、自定义分隔符）
 * 7. state 自动创建
 */

import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { useVario } from '../src/composable.js'
import type { VueSchemaNode } from '../src/types.js'

describe('Model 路径自动解析 - 全面测试', () => {
  describe('1. 循环中的 model 路径处理', () => {
    it('应该支持循环中的扁平路径自动拼接', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'users',  // 父级定义
        loop: {
          items: '{{ users }}',
          itemKey: 'user'
        },
        children: [
          {
            type: 'input',
            model: 'name'  // 扁平路径，应该自动变成 users[0].name, users[1].name...
          },
          {
            type: 'input',
            model: 'age'  // 扁平路径，应该自动变成 users[0].age, users[1].age...
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {
          users: [
            { name: 'John', age: 30 },
            { name: 'Jane', age: 25 }
          ]
        }
      })

      await nextTick()

      // 修改第一个用户的名字
      const children = (vnode.value as any)?.children
      if (children && children[0]) {
        const firstInput = children[0]?.children?.[0]
        if (firstInput?.props?.onInput) {
          firstInput.props.onInput('John Updated')
        } else if (firstInput?.props?.['onUpdate:modelValue']) {
          firstInput.props['onUpdate:modelValue']('John Updated')
        }
      }

      await nextTick()

      expect(state.users[0].name).toBe('John Updated')
      expect(state.users[0].age).toBe(30)
    })

    it('应该支持循环中的明确路径', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',
        loop: {
          items: '{{ users }}',
          itemKey: 'user'
        },
        children: [
          {
            type: 'input',
            model: 'form.user.phone'  // 明确路径，不受循环影响
          },
          {
            type: 'input',
            model: 'email'  // 扁平路径，应该自动变成 form.email
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {
          form: {
            user: { phone: '' }
          },
          users: [{}, {}]
        }
      })

      await nextTick()

      // 设置值
      const children = (vnode.value as any)?.children
      if (children && children[0]) {
        const phoneInput = children[0]?.children?.[0]
        if (phoneInput?.props?.onInput) {
          phoneInput.props.onInput('123456')
        } else if (phoneInput?.props?.['onUpdate:modelValue']) {
          phoneInput.props['onUpdate:modelValue']('123456')
        }
      }

      await nextTick()

      // 明确路径 form.user.phone 应该直接使用，不受循环影响
      expect(state.form.user.phone).toBe('123456')
    })

    it('应该支持循环中嵌套的 model 路径栈', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'data',
        loop: {
          items: '{{ data.items }}',
          itemKey: 'item'
        },
        children: [
          {
            type: 'div',
            model: 'item.profile',  // 使用 item 引用循环项属性，通过循环上下文处理成 data.items[0].profile
            // 明确路径会更新路径栈为 ['item', 'profile']，但循环中会解析为 data.items[0].profile
            children: [
              {
                type: 'input',
                model: 'name'  // 扁平路径，应该拼接路径栈
                // 注意：在循环中，item.profile 会被解析，路径栈需要特殊处理
              }
            ]
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {
          data: {
            items: [
              { profile: {} },
              { profile: {} }
            ]
          }
        }
      })

      await nextTick()

      // 设置值
      const children = (vnode.value as any)?.children
      if (children && children[0]) {
        const profileDiv = children[0]?.children?.[0]
        const nameInput = profileDiv?.children?.[0]
        if (nameInput?.props?.onInput) {
          nameInput.props.onInput('Test Name')
        } else if (nameInput?.props?.['onUpdate:modelValue']) {
          nameInput.props['onUpdate:modelValue']('Test Name')
        }
      }

      await nextTick()

      // item.profile 在循环中会被解析成 data.items[0].profile
      // 明确路径会更新路径栈，但在循环中需要特殊处理
      // 这里主要验证不会报错，实际路径解析逻辑正确
      expect(state.data.items[0].profile.name).toBe('Test Name')
    })
  })

  describe('2. 明确路径不受层级影响', () => {
    it('应该直接使用明确路径，不受父级 model 影响', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',  // 父级定义
        children: [
          {
            type: 'input',
            model: 'form.user.phone'  // 明确路径，应该直接使用，不受 form 影响
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

      // 设置值
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

      // 明确路径应该直接使用
      expect(state.form.user.phone).toBe('123456')
      // 扁平路径应该拼接父级
      expect(state.form.email).toBe('test@example.com')
    })

    it('应该支持跨层级的明确路径', async () => {
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
                model: 'global.settings.theme'  // 明确路径，跨层级使用
              },
              {
                type: 'input',
                model: 'name'  // 扁平路径，应该自动变成 form.user.name
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
      const userDiv = (vnode.value as any)?.children?.[0]
      const themeInput = userDiv?.children?.[0]
      const nameInput = userDiv?.children?.[1]

      if (themeInput?.props?.onInput) {
        themeInput.props.onInput('dark')
      } else if (themeInput?.props?.['onUpdate:modelValue']) {
        themeInput.props['onUpdate:modelValue']('dark')
      }

      if (nameInput?.props?.onInput) {
        nameInput.props.onInput('John')
      } else if (nameInput?.props?.['onUpdate:modelValue']) {
        nameInput.props['onUpdate:modelValue']('John')
      }

      await nextTick()

      // 明确路径应该直接使用，不受 form.user 影响
      expect(state.global.settings.theme).toBe('dark')
      // 扁平路径应该拼接父级
      expect(state.form.user.name).toBe('John')
    })
  })

  describe('3. 扁平路径自动拼接', () => {
    it('应该支持单层扁平路径', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',
        children: [
          { type: 'input', model: 'name' },
          { type: 'input', model: 'age' }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      const nameInput = (vnode.value as any)?.children?.[0]
      if (nameInput?.props?.onInput) {
        nameInput.props.onInput('John')
      } else if (nameInput?.props?.['onUpdate:modelValue']) {
        nameInput.props['onUpdate:modelValue']('John')
      }

      await nextTick()

      expect(state.form.name).toBe('John')
    })

    it('应该支持多层嵌套扁平路径', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',
        children: [
          {
            type: 'div',
            model: 'user',
            children: [
              {
                type: 'div',
                model: 'profile',
                children: [
                  { type: 'input', model: 'name' },  // 应该变成 form.user.profile.name
                  { type: 'input', model: 'age' }    // 应该变成 form.user.profile.age
                ]
              }
            ]
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      const profileDiv = (vnode.value as any)?.children?.[0]?.children?.[0]
      const nameInput = profileDiv?.children?.[0]
      if (nameInput?.props?.onInput) {
        nameInput.props.onInput('John')
      } else if (nameInput?.props?.['onUpdate:modelValue']) {
        nameInput.props['onUpdate:modelValue']('John')
      }

      await nextTick()

      expect(state.form.user.profile.name).toBe('John')
    })

    it('应该支持顶层扁平路径（无父级 model）', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        children: [
          { type: 'input', model: 'username' },  // 顶层，无拼接
          { type: 'input', model: 'age' }         // 顶层，无拼接
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      const usernameInput = (vnode.value as any)?.children?.[0]
      if (usernameInput?.props?.onInput) {
        usernameInput.props.onInput('john_doe')
      } else if (usernameInput?.props?.['onUpdate:modelValue']) {
        usernameInput.props['onUpdate:modelValue']('john_doe')
      }

      await nextTick()

      expect(state.username).toBe('john_doe')
    })
  })

  describe('4. 配置选项', () => {
    it('应该支持 modelPath 对象配置（如 separator）', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: 'name' }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {},
        modelPath: { separator: '.' }
      })

      await nextTick()

      const nameInput = (vnode.value as any)?.children?.[0]
      if (nameInput?.props?.onInput) {
        nameInput.props.onInput('Test')
      } else if (nameInput?.props?.['onUpdate:modelValue']) {
        nameInput.props['onUpdate:modelValue']('Test')
      }

      await nextTick()

      expect(state.form.name).toBe('Test')
    })
  })

  describe('5. 混合使用场景', () => {
    it('应该支持明确路径和扁平路径混合', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',
        children: [
          { type: 'input', model: 'form.user.phone' },  // 明确路径
          { type: 'input', model: 'email' },            // 扁平路径 -> form.email
          { type: 'input', model: 'age' }               // 扁平路径 -> form.age
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      const phoneInput = (vnode.value as any)?.children?.[0]
      const emailInput = (vnode.value as any)?.children?.[1]
      const ageInput = (vnode.value as any)?.children?.[2]

      const setValue = (input: any, value: any) => {
        if (input?.props?.onInput) {
          input.props.onInput(value)
        } else if (input?.props?.['onUpdate:modelValue']) {
          input.props['onUpdate:modelValue'](value)
        }
      }

      setValue(phoneInput, '123456')
      setValue(emailInput, 'test@example.com')
      setValue(ageInput, 30)

      await nextTick()

      expect(state.form.user.phone).toBe('123456')
      expect(state.form.email).toBe('test@example.com')
      expect(state.form.age).toBe(30)
    })

    it('应该支持顶层和嵌套混合', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        children: [
          { type: 'input', model: 'username' },  // 顶层
          {
            type: 'div',
            model: 'form',
            children: [
              { type: 'input', model: 'email' }  // form.email
            ]
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      const usernameInput = (vnode.value as any)?.children?.[0]
      const formDiv = (vnode.value as any)?.children?.[1]
      const emailInput = formDiv?.children?.[0]

      const setValue = (input: any, value: any) => {
        if (input?.props?.onInput) {
          input.props.onInput(value)
        } else if (input?.props?.['onUpdate:modelValue']) {
          input.props['onUpdate:modelValue'](value)
        }
      }

      setValue(usernameInput, 'john_doe')
      setValue(emailInput, 'john@example.com')

      await nextTick()

      expect(state.username).toBe('john_doe')
      expect(state.form.email).toBe('john@example.com')
    })
  })

  describe('6. State 自动创建', () => {
    it('应该自动创建完全缺失的 state 结构', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',
        children: [
          {
            type: 'div',
            model: 'user',
            children: [
              { type: 'input', model: 'name' }
            ]
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}  // 完全空的 state
      })

      await nextTick()

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
      expect(state.form.user.name).toBe('John')
    })

    it('应该支持部分预定义 state', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',
        children: [
          { type: 'input', model: 'name' },
          { type: 'input', model: 'age' }
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

      expect(state.form.age).toBe(30)
    })
  })

  describe('7. 边界情况', () => {
    it('应该处理空 state 和空路径栈', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        children: [
          { type: 'input', model: 'name' }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      const nameInput = (vnode.value as any)?.children?.[0]
      if (nameInput?.props?.onInput) {
        nameInput.props.onInput('Test')
      } else if (nameInput?.props?.['onUpdate:modelValue']) {
        nameInput.props['onUpdate:modelValue']('Test')
      }

      await nextTick()

      expect(state.name).toBe('Test')
    })

    it('应该处理深层嵌套（4层以上）', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'a',
        children: [
          {
            type: 'div',
            model: 'b',
            children: [
              {
                type: 'div',
                model: 'c',
                children: [
                  {
                    type: 'div',
                    model: 'd',
                    children: [
                      { type: 'input', model: 'value' }  // 应该变成 a.b.c.d.value
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      const dDiv = (vnode.value as any)?.children?.[0]?.children?.[0]?.children?.[0]
      const valueInput = dDiv?.children?.[0]
      if (valueInput?.props?.onInput) {
        valueInput.props.onInput('deep value')
      } else if (valueInput?.props?.['onUpdate:modelValue']) {
        valueInput.props['onUpdate:modelValue']('deep value')
      }

      await nextTick()

      expect(state.a.b.c.d.value).toBe('deep value')
    })
  })

  describe('7. [] 语法支持', () => {
    it('应该支持 users[0].name 语法', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        children: [
          {
            type: 'input',
            model: 'users[0].name'  // 使用 [] 语法明确数组访问
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      // 设置值
      const input = (vnode.value as any)?.children?.[0]
      if (input?.props?.onInput) {
        input.props.onInput('John')
      } else if (input?.props?.['onUpdate:modelValue']) {
        input.props['onUpdate:modelValue']('John')
      }

      await nextTick()

      // 验证 users 是数组，且 users[0].name 被正确设置
      expect(Array.isArray(state.users)).toBe(true)
      expect(state.users[0].name).toBe('John')
    })

    it('应该支持嵌套的 [] 语法', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        children: [
          {
            type: 'input',
            model: 'data.users[0].profile.tags[1]'
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      // 设置值
      const input = (vnode.value as any)?.children?.[0]
      if (input?.props?.onInput) {
        input.props.onInput('tag-value')
      } else if (input?.props?.['onUpdate:modelValue']) {
        input.props['onUpdate:modelValue']('tag-value')
      }

      await nextTick()

      // 验证正确的嵌套结构被创建
      expect(typeof state.data).toBe('object')
      expect(Array.isArray(state.data.users)).toBe(true)
      expect(typeof state.data.users[0].profile).toBe('object')
      expect(Array.isArray(state.data.users[0].profile.tags)).toBe(true)
      expect(state.data.users[0].profile.tags[1]).toBe('tag-value')
    })

    it('应该支持混合 [] 和 . 语法', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: 'form',
        children: [
          {
            type: 'input',
            model: 'items[0].value'  // 明确路径，使用 []
          },
          {
            type: 'input',
            model: 'name'  // 扁平路径，拼接成 form.name
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {}
      })

      await nextTick()

      // 设置 items[0].value
      const itemsInput = (vnode.value as any)?.children?.[0]
      if (itemsInput?.props?.onInput) {
        itemsInput.props.onInput('item-value')
      } else if (itemsInput?.props?.['onUpdate:modelValue']) {
        itemsInput.props['onUpdate:modelValue']('item-value')
      }

      // 设置 form.name
      const nameInput = (vnode.value as any)?.children?.[1]
      if (nameInput?.props?.onInput) {
        nameInput.props.onInput('form-name')
      } else if (nameInput?.props?.['onUpdate:modelValue']) {
        nameInput.props['onUpdate:modelValue']('form-name')
      }

      await nextTick()

      // 验证结构
      expect(Array.isArray(state.items)).toBe(true)
      expect(state.items[0].value).toBe('item-value')
      expect(typeof state.form).toBe('object')
      expect(state.form.name).toBe('form-name')
    })
  })
})
