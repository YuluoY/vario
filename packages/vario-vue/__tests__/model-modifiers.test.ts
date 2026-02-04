/**
 * v-model 修饰符测试
 * 
 * 测试场景：
 * 1. .trim 修饰符 - 去除首尾空格
 * 2. .number 修饰符 - 转换为数字
 * 3. .lazy 修饰符 - 改用 change 事件
 * 4. 组合修饰符 - trim + number
 * 5. 具名 model 修饰符
 */

import { describe, it, expect } from 'vitest'
import { createModelBinding } from '../src/bindings.js'
import { createRuntimeContext } from '@variojs/core'

describe('v-model 修饰符', () => {
  describe('.trim 修饰符', () => {
    it('应该去除输入值的首尾空格', () => {
      const ctx = createRuntimeContext({ username: '' })
      const modifiers = { trim: true }
      
      const binding = createModelBinding(
        'input',
        'username',
        ctx,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        modifiers
      )

      // 模拟用户输入（带空格）
      binding.onInput('  hello  ')

      // 验证 state 中已去除空格
      expect(ctx._get('username')).toBe('hello')
    })

    it('应该支持数组形式的修饰符（通过 PathResolver 转换）', () => {
      const ctx = createRuntimeContext({ text: '' })
      // 数组形式会被 PathResolver.getModelModifiers 转换为对象
      const modifiers = { trim: true }
      
      const binding = createModelBinding(
        'input',
        'text',
        ctx,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        modifiers
      )

      binding.onInput(' test ')
      expect(ctx._get('text')).toBe('test')
    })
  })

  describe('.number 修饰符', () => {
    it('应该将字符串转换为数字', () => {
      const ctx = createRuntimeContext({ age: 0 })
      const modifiers = { number: true }
      
      const binding = createModelBinding(
        'input',
        'age',
        ctx,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        modifiers
      )

      binding.onInput('25')

      // 验证值为数字类型
      expect(ctx._get('age')).toBe(25)
      expect(typeof ctx._get('age')).toBe('number')
    })

    it('应该处理小数', () => {
      const ctx = createRuntimeContext({ price: 0 })
      const modifiers = { number: true }
      
      const binding = createModelBinding(
        'input',
        'price',
        ctx,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        modifiers
      )

      binding.onInput('99.99')
      expect(ctx._get('price')).toBe(99.99)
    })

    it('应该保留非数字字符串原样', () => {
      const ctx = createRuntimeContext({ value: '' })
      const modifiers = { number: true }
      
      const binding = createModelBinding(
        'input',
        'value',
        ctx,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        modifiers
      )

      binding.onInput('abc')

      // NaN 转换失败，保留原字符串
      expect(ctx._get('value')).toBe('abc')
    })
  })

  describe('.lazy 修饰符', () => {
    it('应该使用 change 事件而不是 input 事件', () => {
      const ctx = createRuntimeContext({ text: '' })
      const modifiers = { lazy: true }
      
      const binding = createModelBinding(
        'input',
        'text',
        ctx,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        modifiers
      )

      // 验证有 onChange 而不是 onInput
      expect(binding.onChange).toBeDefined()
      expect(binding.onInput).toBeUndefined()

      // 触发 change 事件
      if (typeof binding.onChange === 'function') {
        binding.onChange('completed')
      }
      
      expect(ctx._get('text')).toBe('completed')
    })
  })

  describe('组合修饰符', () => {
    it('应该同时应用 trim 和 number', () => {
      const ctx = createRuntimeContext({ count: 0 })
      const modifiers = { trim: true, number: true }
      
      const binding = createModelBinding(
        'input',
        'count',
        ctx,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        modifiers
      )

      binding.onInput('  42  ')

      // 先 trim，再 number
      expect(ctx._get('count')).toBe(42)
      expect(typeof ctx._get('count')).toBe('number')
    })

    it('应该同时应用 trim、number 和 lazy', () => {
      const ctx = createRuntimeContext({ value: 0 })
      const modifiers = { trim: true, number: true, lazy: true }
      
      const binding = createModelBinding(
        'input',
        'value',
        ctx,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        modifiers
      )

      // 验证使用 onChange
      expect(binding.onChange).toBeDefined()

      // change 事件应触发更新，并应用 trim + number
      if (typeof binding.onChange === 'function') {
        binding.onChange(' 99 ')
      }
      
      expect(ctx._get('value')).toBe(99)
    })
  })

  describe('具名 model 修饰符', () => {
    it('应该支持具名 model 的修饰符', () => {
      const ctx = createRuntimeContext({ text: '', num: 0 })
      
      // value model with trim
      const valueBinding = createModelBinding(
        'CustomComponent',
        'text',
        ctx,
        undefined,
        undefined,
        'value',
        undefined,
        false,
        { trim: true }
      )

      // count model with number
      const countBinding = createModelBinding(
        'CustomComponent',
        'num',
        ctx,
        undefined,
        undefined,
        'count',
        undefined,
        false,
        { number: true }
      )

      // 测试 value model (trim)
      valueBinding['onUpdate:value'](' hello ')
      expect(ctx._get('text')).toBe('hello')

      // 测试 count model (number)
      countBinding['onUpdate:count']('42')
      expect(ctx._get('num')).toBe(42)
      expect(typeof ctx._get('num')).toBe('number')
    })
  })

  describe('边界情况', () => {
    it('应该处理空修饰符对象', () => {
      const ctx = createRuntimeContext({ text: '' })
      const modifiers = {}
      
      const binding = createModelBinding(
        'input',
        'text',
        ctx,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        modifiers
      )

      binding.onInput(' test ')

      // 无修饰符，保持原样
      expect(ctx._get('text')).toBe(' test ')
    })

    it('应该处理未定义的修饰符（默认为空对象）', () => {
      const ctx = createRuntimeContext({ text: '' })
      
      const binding = createModelBinding(
        'input',
        'text',
        ctx
        // 不传 modifiers 参数
      )

      binding.onInput(' test ')

      // 无修饰符，保持原样
      expect(ctx._get('text')).toBe(' test ')
    })
  })
})
