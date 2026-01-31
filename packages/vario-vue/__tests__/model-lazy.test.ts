/**
 * Model Lazy 功能测试
 * 
 * 测试内容：
 * - 全局 lazy 配置
 * - 节点级 lazy 覆盖
 * - 用户传入 state 优先级
 * - 非用户交互不写入 state
 * - 具名 model 支持
 */

import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { useVario } from '../src/composable.js'
import type { VueSchemaNode } from '../src/types.js'

describe('Model Lazy 功能', () => {
  describe('全局 lazy 配置 (modelOptions.lazy)', () => {
    it('lazy: true 时，未交互的 model 不应预写 state', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: 'name' },
          { type: 'input', model: 'email' }
        ]
      }

      const { state } = useVario(schema, {
        state: {},
        modelOptions: { lazy: true }
      })

      await nextTick()

      // 未交互时，state 中不应存在 form
      expect(state.form).toBeUndefined()
    })

    it('lazy: false (默认) 时，初始化即预写 state', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: 'name' }
        ]
      }

      const { state } = useVario(schema, {
        state: {}
      })

      await nextTick()

      // 应该预写默认值
      expect(state.form).toBeDefined()
      expect(state.form.name).toBe('')
    })

    it('用户交互后，lazy model 应正确写入 state', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: 'name' }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {},
        modelOptions: { lazy: true }
      })

      await nextTick()
      // 等待 setTimeout 激活事件处理器
      await new Promise(resolve => setTimeout(resolve, 10))

      // 初始状态
      expect(state.form).toBeUndefined()

      // 模拟用户交互
      const input = (vnode.value as any)?.children?.[0]
      if (input?.props?.['onUpdate:modelValue']) {
        input.props['onUpdate:modelValue']('John')
      } else if (input?.props?.onInput) {
        input.props.onInput('John')
      }

      await nextTick()

      // 用户交互后应写入 state
      expect(state.form?.name).toBe('John')
    })
  })

  describe('节点级 lazy 配置', () => {
    it('节点 lazy: false 可覆盖全局 lazy: true', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: { path: 'required', lazy: false } },
          { type: 'input', model: 'optional' }
        ]
      }

      const { state } = useVario(schema, {
        state: {},
        modelOptions: { lazy: true }
      })

      await nextTick()

      // required (lazy: false) 应预写
      expect(state.form?.required).toBe('')
      // optional (继承全局 lazy: true) 不应预写
      expect(state.form?.optional).toBeUndefined()
    })

    it('节点 lazy: true 可覆盖全局 lazy: false', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: 'name' },
          { type: 'input', model: { path: 'nickname', lazy: true } }
        ]
      }

      const { state } = useVario(schema, {
        state: {},
        modelOptions: { lazy: false }
      })

      await nextTick()

      // name (继承全局 lazy: false) 应预写
      expect(state.form?.name).toBe('')
      // nickname (lazy: true) 不应预写
      expect(state.form?.nickname).toBeUndefined()
    })
  })

  describe('用户传入 state 优先级', () => {
    it('state 中已存在的值应直接使用，忽略 lazy 配置', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: { path: 'name', lazy: true } }
        ]
      }

      const { state } = useVario(schema, {
        state: {
          form: {
            name: 'Preset Value'
          }
        },
        modelOptions: { lazy: true }
      })

      await nextTick()

      // 应直接使用传入的值，不受 lazy 影响
      expect(state.form.name).toBe('Preset Value')
    })

    it('state 中部分存在时，仅对不存在的 path 应用 lazy', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: 'existing' },
          { type: 'input', model: 'newField' }
        ]
      }

      const { state } = useVario(schema, {
        state: {
          form: {
            existing: 'I exist'
          }
        },
        modelOptions: { lazy: true }
      })

      await nextTick()

      // existing 有传入值
      expect(state.form?.existing).toBe('I exist')
      // newField 受 lazy 影响，未预写
      expect(state.form?.newField).toBeUndefined()
    })
  })

  describe('具名 model (model:xxx) 支持', () => {
    it('具名 model 应支持独立的 lazy 配置', async () => {
      const schema: VueSchemaNode = {
        type: 'custom-comp',
        model: { path: 'form', scope: true },
        'model:value': { path: 'text', lazy: true },
        'model:visible': { path: 'show', lazy: false, default: true }
      }

      const { state } = useVario(schema, {
        state: {},
        modelOptions: { lazy: false }
      })

      await nextTick()

      // text (lazy: true) 不应预写
      expect(state.form?.text).toBeUndefined()
      // show (lazy: false) 应预写默认值
      expect(state.form?.show).toBe(true)
    })

    it('具名 model 应继承全局 lazy 配置', async () => {
      const schema: VueSchemaNode = {
        type: 'custom-comp',
        model: { path: 'form', scope: true },
        'model:value': 'text'
      }

      const { state } = useVario(schema, {
        state: {},
        modelOptions: { lazy: true }
      })

      await nextTick()

      // 未显式配置 lazy，继承全局 lazy: true
      expect(state.form?.text).toBeUndefined()
    })
  })

  describe('默认值支持', () => {
    it('lazy: true 时应使用 default 但不写入 state', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { 
            type: 'input', 
            model: { path: 'count', lazy: true, default: 0 }
          }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {},
        modelOptions: { lazy: true }
      })

      await nextTick()

      // state 中不应预写
      expect(state.form?.count).toBeUndefined()

      // 但 vnode 的 props 应包含默认值
      const input = (vnode.value as any)?.children?.[0]
      expect(input?.props?.modelValue ?? input?.props?.value).toBe(0)
    })

    it('lazy: false 时应预写 default 到 state', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { 
            type: 'input', 
            model: { path: 'count', default: 10 }
          }
        ]
      }

      const { state } = useVario(schema, {
        state: {}
      })

      await nextTick()

      expect(state.form?.count).toBe(10)
    })
  })

  describe('复杂场景', () => {
    it('嵌套 scope 中的 lazy 应正确工作', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          {
            type: 'div',
            model: { path: 'user', scope: true },
            children: [
              { type: 'input', model: { path: 'name', lazy: false } },
              { type: 'input', model: 'bio' }
            ]
          }
        ]
      }

      const { state } = useVario(schema, {
        state: {},
        modelOptions: { lazy: true }
      })

      await nextTick()

      // name (lazy: false) 应预写
      expect(state.form?.user?.name).toBe('')
      // bio (lazy: true) 不应预写
      expect(state.form?.user?.bio).toBeUndefined()
    })

    it('lazy model 在挂载阶段自动触发时不应写入 state', async () => {
      const schema: VueSchemaNode = {
        type: 'div',
        model: { path: 'form', scope: true },
        children: [
          { type: 'input', model: 'field1' },
          { type: 'input', model: 'field2' }
        ]
      }

      const { state, vnode } = useVario(schema, {
        state: {},
        modelOptions: { lazy: true }
      })

      await nextTick()

      // 初始都未写入
      expect(state.form).toBeUndefined()

      // 模拟组件挂载阶段的自动触发（此时 isMounted 为 false）
      // 这是某些组件库组件的行为：挂载后自动触发 update:modelValue
      const field1Input = (vnode.value as any)?.children?.[0]
      if (field1Input?.props?.['onUpdate:modelValue']) {
        field1Input.props['onUpdate:modelValue']('auto-triggered')
      }

      await nextTick()

      // 由于是挂载阶段的自动触发，不应写入 state
      expect(state.form).toBeUndefined()
    })
  })
})
