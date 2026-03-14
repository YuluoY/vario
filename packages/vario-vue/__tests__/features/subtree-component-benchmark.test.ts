/**
 * Scope-Weight Hybrid 性能基准测试
 * 
 * 验证自适应优化（Scope-Weight Hybrid）的渲染性能。
 * Scope-Weight 为零配置自适应策略，无手动开关。
 */
import { describe, it, expect } from 'vitest'
import { VueRenderer } from '../../src/renderer'
import { createRuntimeContext } from '@variojs/core'
import {
  COMPONENT_OVERHEAD,
  createWeightCache,
  computeWeight,
  computeLoopTemplateWeight,
  isScopeBoundary
} from '../../src/features/schema-weight'
import type { SchemaNode } from '@variojs/schema'

// 性能测量工具
function measure(name: string, fn: () => void, iterations: number = 10): { avg: number; total: number } {
  const times: number[] = []
  
  // 预热
  for (let i = 0; i < 3; i++) {
    fn()
  }
  
  // 正式测量
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    times.push(performance.now() - start)
  }
  
  const total = times.reduce((a, b) => a + b, 0)
  const avg = total / times.length
  return { avg, total }
}

// 生成深度嵌套的 Schema
function generateDeepSchema(depth: number, breadth: number = 2): SchemaNode {
  if (depth <= 0) {
    return { type: 'span', children: 'leaf' }
  }
  
  const children: SchemaNode[] = []
  for (let i = 0; i < breadth; i++) {
    children.push(generateDeepSchema(depth - 1, breadth))
  }
  
  return {
    type: 'div',
    props: { class: `level-${depth}` },
    children
  }
}

// 生成带自定义组件的 Schema（用于 boundary 测试）
function generateBoundarySchema(depth: number): SchemaNode {
  if (depth <= 0) {
    return { type: 'span', children: 'leaf' }
  }
  
  // 交替使用原生元素和自定义组件
  const isCustomComponent = depth % 2 === 0
  const type = isCustomComponent ? 'MyButton' : 'div'
  
  return {
    type,
    props: { class: `level-${depth}` },
    children: [generateBoundarySchema(depth - 1)]
  }
}

// 生成列表 Schema
function generateListSchema(itemCount: number): SchemaNode {
  return {
    type: 'ul',
    children: [
      {
        type: 'li',
        loop: { items: '{{ items }}', itemKey: 'item', indexKey: 'idx' },
        children: '{{ item.name }}'
      }
    ]
  }
}

describe('Scope-Weight 性能基准', () => {
  const results: Record<string, { avg: number; total: number }> = {}

  describe('1. 深度嵌套渲染 (243节点, 5层x3宽)', () => {
    const schema = generateDeepSchema(5, 3)

    it('渲染性能', () => {
      const renderer = new VueRenderer()
      const ctx = createRuntimeContext({})
      const r = measure('深度嵌套-243节点', () => renderer.render(schema, ctx), 20)
      results['深度嵌套-243节点'] = r
      console.log(`深度嵌套-243节点: ${r.avg.toFixed(2)}ms`)
      expect(r.avg).toBeDefined()
    })
  })

  describe('2. 边界组件渲染 (10层交替)', () => {
    const schema = generateBoundarySchema(10)

    it('渲染性能', () => {
      const renderer = new VueRenderer({
        components: { MyButton: { template: '<button><slot/></button>' } }
      })
      const ctx = createRuntimeContext({})
      const r = measure('边界组件-10层', () => renderer.render(schema, ctx), 30)
      results['边界组件-10层'] = r
      console.log(`边界组件-10层: ${r.avg.toFixed(2)}ms`)
      expect(r.avg).toBeDefined()
    })
  })

  describe('3. 列表渲染 (100项)', () => {
    const schema = generateListSchema(100)
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }))

    it('渲染性能', () => {
      const renderer = new VueRenderer()
      const ctx = createRuntimeContext({ items })
      const r = measure('列表-100项', () => renderer.render(schema, ctx), 20)
      results['列表-100项'] = r
      console.log(`列表-100项: ${r.avg.toFixed(2)}ms`)
      expect(r.avg).toBeDefined()
    })
  })

  describe('4. 重复渲染 (10次状态更新)', () => {
    const schema: SchemaNode = {
      type: 'div',
      children: [
        { type: 'span', children: '{{ count }}' },
        { type: 'p', children: '{{ name }}' },
        {
          type: 'ul',
          children: [
            { type: 'li', children: 'Static 1' },
            { type: 'li', children: 'Static 2' },
            { type: 'li', children: 'Static 3' }
          ]
        }
      ]
    }

    it('渲染性能', () => {
      const renderer = new VueRenderer()
      const r = measure('重复渲染-10次', () => {
        for (let i = 0; i < 10; i++) {
          const ctx = createRuntimeContext({ count: i, name: `Name ${i}` })
          renderer.render(schema, ctx)
        }
      }, 10)
      results['重复渲染-10次'] = r
      console.log(`重复渲染-10次: ${r.avg.toFixed(2)}ms`)
      expect(r.avg).toBeDefined()
    })
  })

  describe('5. 大规模 Schema (256节点)', () => {
    const schema = generateDeepSchema(8, 2)

    it('渲染性能', () => {
      const renderer = new VueRenderer()
      const ctx = createRuntimeContext({})
      const r = measure('大规模-256节点', () => renderer.render(schema, ctx), 20)
      results['大规模-256节点'] = r
      console.log(`大规模-256节点: ${r.avg.toFixed(2)}ms`)
      expect(r.avg).toBeDefined()
    })
  })

  describe('6. 150节点缓存效果', () => {
    const schema: SchemaNode = {
      type: 'div',
      children: Array.from({ length: 50 }, (_, i) => ({
        type: 'div',
        props: { class: `item-${i}` },
        children: [
          { type: 'span', children: `Label ${i}` },
          { type: 'p', children: `Description ${i}` }
        ]
      }))
    }

    it('首次渲染', () => {
      const renderer = new VueRenderer()
      const ctx = createRuntimeContext({})
      const r = measure('150节点-首次', () => renderer.render(schema, ctx), 20)
      results['150节点-首次'] = r
      console.log(`150节点-首次: ${r.avg.toFixed(2)}ms`)
      expect(r.avg).toBeDefined()
    })

    it('二次渲染 (path-memo 命中)', () => {
      const renderer = new VueRenderer()
      const ctx = createRuntimeContext({})
      renderer.render(schema, ctx)
      const r = measure('150节点-缓存', () => renderer.render(schema, ctx), 20)
      results['150节点-缓存'] = r
      console.log(`150节点-缓存: ${r.avg.toFixed(2)}ms`)
      expect(r.avg).toBeDefined()
    })
  })

  describe('7. computeWeight / isScopeBoundary 开销', () => {
    it('computeWeight 计算开销 (243节点)', () => {
      const schema = generateDeepSchema(5, 3)
      const r = measure('computeWeight-243节点', () => {
        const cache = createWeightCache()
        computeWeight(schema, cache)
      }, 50)
      results['computeWeight开销'] = r
      console.log(`computeWeight-243节点: ${r.avg.toFixed(4)}ms`)
      expect(r.avg).toBeLessThan(5)
    })

    it('computeWeight 缓存命中时开销极低', () => {
      const schema = generateDeepSchema(5, 3)
      const cache = createWeightCache()
      computeWeight(schema, cache)
      const r = measure('computeWeight-缓存', () => computeWeight(schema, cache), 100)
      results['computeWeight缓存命中'] = r
      console.log(`computeWeight-缓存命中: ${r.avg.toFixed(4)}ms`)
      expect(r.avg).toBeLessThan(0.1)
    })

    it('isScopeBoundary 判断开销极低', () => {
      const nodes = [
        { type: 'div' },
        { type: 'ElButton' },
        { type: 'div', model: 'name' } as any,
        { type: 'div', onMounted: 'init' } as any,
      ]
      const r = measure('isScopeBoundary', () => {
        for (const n of nodes) isScopeBoundary(n)
      }, 1000)
      results['isScopeBoundary开销'] = r
      console.log(`isScopeBoundary: ${r.avg.toFixed(4)}ms`)
      expect(r.avg).toBeLessThan(0.1)
    })
  })

  describe('结果汇总', () => {
    it('输出汇总', () => {
      console.log('\n')
      console.log('╔════════════════════════════════════════════════════════════╗')
      console.log('║         Scope-Weight Hybrid 性能基准结果                   ║')
      console.log('╠════════════════════════════════════════════════════════════╣')
      console.log(`║ 测试日期: ${new Date().toISOString().split('T')[0]}                                   ║`)
      console.log(`║ COMPONENT_OVERHEAD = ${COMPONENT_OVERHEAD}                                    ║`)
      console.log('╠════════════════════════════════════════════════════════════╣')

      for (const [name, r] of Object.entries(results)) {
        console.log(`║  ${name.padEnd(30)} ${r.avg.toFixed(4).padStart(10)}ms  ║`)
      }

      console.log('╠════════════════════════════════════════════════════════════╣')
      console.log('║ 说明：Scope-Weight 为零配置自适应策略                      ║')
      console.log('║ scope boundary + weight > OVERHEAD 时自动组件化            ║')
      console.log('╚════════════════════════════════════════════════════════════╝')
      expect(true).toBe(true)
    })
  })
})
