/**
 * 双向绑定单例测试
 * 
 * 测试：
 * - 原生元素的绑定
 * - Vue 3 组件的绑定
 * - 自动检测
 * - 自定义配置
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createModelBinding, registerModelConfig, clearModelConfigs } from '../src/bindings.js'
import { createRuntimeContext } from '@variojs/core'

describe('createModelBinding', () => {
  let ctx: ReturnType<typeof createRuntimeContext>

  beforeEach(() => {
    ctx = createRuntimeContext({
      name: 'Test',
      email: 'test@example.com'
    })
    clearModelConfigs()
  })

  describe('原生元素', () => {
    it('应该为 input 创建 value/onInput 绑定', () => {
      const binding = createModelBinding('input', 'name', ctx)
      
      expect(binding.value).toBe('Test')
      expect(typeof binding.onInput).toBe('function')
    })

    it('应该为 textarea 创建 value/onInput 绑定', () => {
      const binding = createModelBinding('textarea', 'name', ctx)
      
      expect(binding.value).toBe('Test')
      expect(typeof binding.onInput).toBe('function')
    })

    it('应该为 select 创建 value/onChange 绑定', () => {
      const binding = createModelBinding('select', 'name', ctx)
      
      expect(binding.value).toBe('Test')
      expect(typeof binding.onChange).toBe('function')
    })

    it('应该更新状态当值改变时', () => {
      const binding = createModelBinding('input', 'name', ctx)
      
      binding.onInput('New Name')
      expect(ctx._get('name')).toBe('New Name')
    })
  })

  describe('Vue 3 组件（默认）', () => {
    it('应该为 Vue 3 组件创建 modelValue/onUpdate:modelValue 绑定', () => {
      const binding = createModelBinding('ElInput', 'name', ctx)
      
      expect(binding.modelValue).toBe('Test')
      expect(typeof binding['onUpdate:modelValue']).toBe('function')
    })

    it('应该更新状态当值改变时', () => {
      const binding = createModelBinding('ElInput', 'name', ctx)
      
      binding['onUpdate:modelValue']('New Name')
      expect(ctx._get('name')).toBe('New Name')
    })
  })

  describe('自定义配置', () => {
    it('应该使用自定义配置', () => {
      registerModelConfig('CustomInput', {
        prop: 'value',
        event: 'update:value'
      })

      const binding = createModelBinding('CustomInput', 'name', ctx)
      
      expect(binding.value).toBe('Test')
      expect(typeof binding['onUpdate:value']).toBe('function')
    })

    it('应该更新状态当值改变时', () => {
      registerModelConfig('CustomInput', {
        prop: 'value',
        event: 'update:value'
      })

      const binding = createModelBinding('CustomInput', 'name', ctx)
      binding['onUpdate:value']('New Name')
      
      expect(ctx._get('name')).toBe('New Name')
    })
  })

  describe('嵌套路径', () => {
    it('应该支持嵌套路径绑定', () => {
      ctx.user = { name: 'John' }
      const binding = createModelBinding('input', 'user.name', ctx)
      
      expect(binding.value).toBe('John')
      
      binding.onInput('Jane')
      expect(ctx._get('user.name')).toBe('Jane')
    })
  })

  describe('schema 默认值', () => {
    it('当状态未初始化时使用 schemaDefault 并写回状态', () => {
      const emptyCtx = createRuntimeContext({})
      const binding = createModelBinding(
        'input',
        'name',
        emptyCtx,
        undefined,
        undefined,
        undefined,
        '默认名'
      )
      expect(binding.value).toBe('默认名')
      expect(emptyCtx._get('name')).toBe('默认名')
    })

    it('状态已有值时不用 schemaDefault', () => {
      const binding = createModelBinding(
        'input',
        'name',
        ctx,
        undefined,
        undefined,
        undefined,
        '默认名'
      )
      expect(binding.value).toBe('Test')
      expect(ctx._get('name')).toBe('Test')
    })
  })
})
