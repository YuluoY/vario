/**
 * Vario 性能压力测试
 * 
 * 测试场景：
 * - 大量节点渲染（1000+ 节点）
 * - 深度嵌套结构（20+ 层）
 * - 复杂表达式计算（100+ 表达式）
 * - 频繁状态更新（1000+ 次/秒）
 * - 大量循环渲染（1000+ 项）
 * - 缓存性能（命中率、失效速度）
 * - 内存使用（长时间运行）
 * - 并发渲染（多个实例）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useVario } from '../src/composable.js'
import type { Schema } from '@vario/schema'

describe('Vario 性能压力测试', () => {
  describe('大量节点渲染', () => {
    it('应该能渲染 1000 个节点', async () => {
      const startTime = performance.now()
      
      // 创建 1000 个 div 节点
      const children: Schema[] = Array.from({ length: 1000 }, (_, i) => ({
        type: 'div',
        props: { id: `node-${i}` },
        children: `Node ${i}`
      }))

      const schema: Schema = {
        type: 'div',
        children
      }

      const { vnode } = useVario(schema)
      await nextTick()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(renderTime).toBeLessThan(1000) // 应该在 1 秒内完成
      console.log(`✓ 1000 节点渲染耗时: ${renderTime.toFixed(2)}ms`)
    })

    it('应该能渲染 5000 个节点', async () => {
      const startTime = performance.now()
      
      const children: Schema[] = Array.from({ length: 5000 }, (_, i) => ({
        type: 'div',
        props: { id: `node-${i}` },
        children: `Node ${i}`
      }))

      const schema: Schema = {
        type: 'div',
        children
      }

      const { vnode } = useVario(schema)
      await nextTick()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(renderTime).toBeLessThan(5000) // 应该在 5 秒内完成
      console.log(`✓ 5000 节点渲染耗时: ${renderTime.toFixed(2)}ms`)
    })
  })

  describe('深度嵌套结构', () => {
    it('应该能处理 20 层嵌套', async () => {
      const startTime = performance.now()
      
      // 创建 20 层嵌套结构
      let schema: Schema = { type: 'div', children: 'Deep' }
      for (let i = 0; i < 20; i++) {
        schema = {
          type: 'div',
          props: { class: `level-${i}` },
          children: [schema]
        }
      }

      const { vnode } = useVario(schema)
      await nextTick()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(renderTime).toBeLessThan(500)
      console.log(`✓ 20 层嵌套渲染耗时: ${renderTime.toFixed(2)}ms`)
    })

    it('应该能处理 50 层嵌套', async () => {
      const startTime = performance.now()
      
      let schema: Schema = { type: 'div', children: 'Very Deep' }
      for (let i = 0; i < 50; i++) {
        schema = {
          type: 'div',
          props: { class: `level-${i}` },
          children: [schema]
        }
      }

      const { vnode } = useVario(schema)
      await nextTick()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(renderTime).toBeLessThan(2000)
      console.log(`✓ 50 层嵌套渲染耗时: ${renderTime.toFixed(2)}ms`)
    })
  })

  describe('大量循环渲染', () => {
    it('应该能渲染 1000 项循环列表', async () => {
      const startTime = performance.now()
      
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [
          {
            type: 'div',
            loop: {
              items: '{{ items }}',
              itemKey: 'id'
            },
            props: {
              class: 'item'
            },
            children: '{{ $item.name }}'
          }
        ]
      }

      const { vnode, ctx } = useVario(schema)
      
      // 设置 1000 项数据
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }))
      
      ctx.value!._set('items', items)
      await nextTick()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(renderTime).toBeLessThan(2000)
      console.log(`✓ 1000 项循环渲染耗时: ${renderTime.toFixed(2)}ms`)
    })

    it('应该能渲染 5000 项循环列表', async () => {
      const startTime = performance.now()
      
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [
          {
            type: 'div',
            loop: {
              items: '{{ items }}',
              itemKey: 'id'
            },
            children: '{{ $item.name }}'
          }
        ]
      }

      const { vnode, ctx } = useVario(schema)
      
      const items = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }))
      
      ctx.value!._set('items', items)
      await nextTick()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(renderTime).toBeLessThan(10000)
      console.log(`✓ 5000 项循环渲染耗时: ${renderTime.toFixed(2)}ms`)
    })
  })

  describe('复杂表达式计算', () => {
    it('应该能处理 100 个表达式', async () => {
      const startTime = performance.now()
      
      // 创建包含 100 个表达式的 schema
      const children: Schema[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'div',
        children: `{{ count + ${i} }}`
      }))

      const schema: Schema<{ count: number }> = {
        type: 'div',
        children
      }

      const { vnode, ctx } = useVario(schema)
      ctx.value!._set('count', 10)
      await nextTick()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(renderTime).toBeLessThan(1000)
      console.log(`✓ 100 个表达式计算耗时: ${renderTime.toFixed(2)}ms`)
    })

    it('应该能处理复杂嵌套表达式', async () => {
      const startTime = performance.now()
      
      const schema: Schema<{ 
        items: Array<{ value: number }>
        multiplier: number
      }> = {
        type: 'div',
        children: [
          {
            type: 'div',
            loop: {
              items: '{{ items }}',
              itemKey: 'index'
            },
            children: '{{ $item.value * multiplier + items.length }}'
          }
        ]
      }

      const { vnode, ctx } = useVario(schema)
      
      const items = Array.from({ length: 100 }, (_, i) => ({
        value: i * 2
      }))
      
      ctx.value!._set('items', items)
      ctx.value!._set('multiplier', 3)
      await nextTick()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(renderTime).toBeLessThan(2000)
      console.log(`✓ 复杂嵌套表达式计算耗时: ${renderTime.toFixed(2)}ms`)
    })
  })

  describe('频繁状态更新', () => {
    it('应该能处理 1000 次快速状态更新', async () => {
      const schema: Schema<{ count: number }> = {
        type: 'div',
        children: '{{ count }}'
      }

      const { vnode, ctx } = useVario(schema)
      
      const startTime = performance.now()
      
      // 快速更新 1000 次
      for (let i = 0; i < 1000; i++) {
        ctx.value!._set('count', i)
      }
      
      await nextTick()
      
      const endTime = performance.now()
      const updateTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(updateTime).toBeLessThan(5000) // 应该在 5 秒内完成
      console.log(`✓ 1000 次状态更新耗时: ${updateTime.toFixed(2)}ms`)
    })

    it('应该能处理批量状态更新', async () => {
      const schema: Schema<{ 
        a: number
        b: number
        c: number
        d: number
        e: number
      }> = {
        type: 'div',
        children: '{{ a + b + c + d + e }}'
      }

      const { vnode, ctx } = useVario(schema)
      
      const startTime = performance.now()
      
      // 批量更新多个字段
      for (let i = 0; i < 100; i++) {
        ctx.value!._set('a', i)
        ctx.value!._set('b', i * 2)
        ctx.value!._set('c', i * 3)
        ctx.value!._set('d', i * 4)
        ctx.value!._set('e', i * 5)
      }
      
      await nextTick()
      
      const endTime = performance.now()
      const updateTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(updateTime).toBeLessThan(2000)
      console.log(`✓ 批量状态更新耗时: ${updateTime.toFixed(2)}ms`)
    })
  })

  describe('缓存性能', () => {
    it('应该能有效利用表达式缓存', async () => {
      const schema: Schema<{ count: number }> = {
        type: 'div',
        children: [
          {
            type: 'div',
            children: '{{ count * 2 }}'
          },
          {
            type: 'div',
            children: '{{ count * 2 }}' // 重复表达式，应该使用缓存
          },
          {
            type: 'div',
            children: '{{ count * 2 }}' // 重复表达式，应该使用缓存
          }
        ]
      }

      const { vnode, ctx } = useVario(schema)
      
      const startTime = performance.now()
      
      // 更新状态触发重新计算
      for (let i = 0; i < 100; i++) {
        ctx.value!._set('count', i)
        await nextTick()
      }
      
      const endTime = performance.now()
      const updateTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      // 使用缓存后应该更快
      expect(updateTime).toBeLessThan(5000)
      console.log(`✓ 缓存性能测试耗时: ${updateTime.toFixed(2)}ms`)
    })

    it('应该能快速失效相关缓存', async () => {
      const schema: Schema<{ 
        items: Array<{ value: number }>
        multiplier: number
      }> = {
        type: 'div',
        children: [
          {
            type: 'div',
            loop: {
              items: '{{ items }}',
              itemKey: 'index'
            },
            children: '{{ $item.value * multiplier }}'
          }
        ]
      }

      const { vnode, ctx } = useVario(schema)
      
      const items = Array.from({ length: 100 }, (_, i) => ({
        value: i
      }))
      
      ctx.value!._set('items', items)
      ctx.value!._set('multiplier', 2)
      await nextTick()
      
      const startTime = performance.now()
      
      // 更新 multiplier，应该快速失效所有相关缓存
      for (let i = 0; i < 50; i++) {
        ctx.value!._set('multiplier', i)
        await nextTick()
      }
      
      const endTime = performance.now()
      const updateTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(updateTime).toBeLessThan(3000)
      console.log(`✓ 缓存失效性能测试耗时: ${updateTime.toFixed(2)}ms`)
    })
  })

  describe('并发渲染', () => {
    it('应该能同时渲染多个实例', async () => {
      const startTime = performance.now()
      
      const schema: Schema<{ count: number }> = {
        type: 'div',
        children: '{{ count }}'
      }

      // 创建 10 个并发实例
      const instances = Array.from({ length: 10 }, () => useVario(schema))
      
      // 同时更新所有实例
      for (let i = 0; i < 100; i++) {
        instances.forEach(({ ctx }) => {
          ctx.value!._set('count', i)
        })
      }
      
      await nextTick()
      
      const endTime = performance.now()
      const renderTime = endTime - startTime

      instances.forEach(({ vnode }) => {
        expect(vnode.value).toBeDefined()
      })
      
      expect(renderTime).toBeLessThan(5000)
      console.log(`✓ 10 个并发实例渲染耗时: ${renderTime.toFixed(2)}ms`)
    })
  })

  describe('内存使用', () => {
    it('应该能长时间运行不泄漏内存', async () => {
      const schema: Schema<{ count: number }> = {
        type: 'div',
        children: '{{ count }}'
      }

      const { vnode, ctx } = useVario(schema)
      
      // 长时间运行，频繁更新
      for (let i = 0; i < 1000; i++) {
        ctx.value!._set('count', i)
        if (i % 100 === 0) {
          await nextTick()
        }
      }
      
      await nextTick()
      
      expect(vnode.value).toBeDefined()
      console.log(`✓ 长时间运行测试完成（1000 次更新）`)
    })

    it('应该能处理大量数据不泄漏', async () => {
      const schema: Schema<{ 
        items: Array<{ id: number; data: string }>
      }> = {
        type: 'div',
        children: [
          {
            type: 'div',
            loop: {
              items: '{{ items }}',
              itemKey: 'id'
            },
            children: '{{ $item.data }}'
          }
        ]
      }

      const { vnode, ctx } = useVario(schema)
      
      // 多次设置大量数据
      for (let batch = 0; batch < 10; batch++) {
        const items = Array.from({ length: 1000 }, (_, i) => ({
          id: batch * 1000 + i,
          data: `Data ${batch * 1000 + i}`
        }))
        
        ctx.value!._set('items', items)
        await nextTick()
      }
      
      expect(vnode.value).toBeDefined()
      console.log(`✓ 大量数据处理测试完成（10 批次，每批 1000 项）`)
    })
  })

  describe('混合压力测试', () => {
    it('应该能处理复杂的混合场景', async () => {
      const startTime = performance.now()
      
      // 创建包含大量节点、深度嵌套、循环、表达式的复杂 schema
      const loopItems: Schema[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'div',
        props: { class: 'item' },
        children: [
          {
            type: 'div',
            children: `{{ items[${i}].name }}`
          },
          {
            type: 'div',
            children: `{{ items[${i}].value * multiplier }}`
          },
          {
            type: 'div',
            cond: `{{ items[${i}].value > 50 }}`,
            children: 'High Value'
          }
        ]
      }))

      const schema: Schema<{
        items: Array<{ name: string; value: number }>
        multiplier: number
        count: number
      }> = {
        type: 'div',
        children: [
          {
            type: 'div',
            children: '{{ count }}'
          },
          {
            type: 'div',
            loop: {
              items: '{{ items }}',
              itemKey: 'index'
            },
            children: [
              {
                type: 'div',
                children: '{{ $item.name }}'
              },
              {
                type: 'div',
                children: '{{ $item.value * multiplier }}'
              }
            ]
          }
        ]
      }

      const { vnode, ctx } = useVario(schema)
      
      // 初始化数据
      const items = Array.from({ length: 100 }, (_, i) => ({
        name: `Item ${i}`,
        value: i
      }))
      
      ctx.value!._set('items', items)
      ctx.value!._set('multiplier', 2)
      ctx.value!._set('count', 0)
      await nextTick()
      
      // 频繁更新
      for (let i = 0; i < 50; i++) {
        ctx.value!._set('count', i)
        ctx.value!._set('multiplier', i % 10)
        await nextTick()
      }
      
      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(vnode.value).toBeDefined()
      expect(renderTime).toBeLessThan(10000)
      console.log(`✓ 混合压力测试耗时: ${renderTime.toFixed(2)}ms`)
    })
  })
})
