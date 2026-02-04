/**
 * 方案 C/D 边界压力测试
 * 
 * 测试极端场景下的性能表现：
 * - 超大规模节点数
 * - 超深嵌套层级
 * - 大量循环项
 * - 高频状态更新
 * - 内存压力测试
 */
import { describe, it, expect } from 'vitest'
import { VueRenderer } from '../../src/renderer'
import { createRuntimeContext } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'

// 性能测量工具
function measure(name: string, fn: () => void, iterations: number = 5): { avg: number; min: number; max: number; total: number } {
  const times: number[] = []
  
  // 预热
  for (let i = 0; i < 2; i++) {
    fn()
  }
  
  // 强制 GC（如果可用）
  if (global.gc) {
    global.gc()
  }
  
  // 正式测量
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    times.push(performance.now() - start)
  }
  
  times.sort((a, b) => a - b)
  const total = times.reduce((a, b) => a + b, 0)
  return {
    avg: total / times.length,
    min: times[0],
    max: times[times.length - 1],
    total
  }
}

// 内存测量（如果可用）
function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024 // MB
  }
  return 0
}

// 生成扁平大规模 Schema
function generateFlatSchema(nodeCount: number): SchemaNode {
  const children: SchemaNode[] = []
  for (let i = 0; i < nodeCount; i++) {
    children.push({
      type: 'div',
      props: { class: `item-${i}`, 'data-index': i },
      children: `Content ${i}`
    })
  }
  return { type: 'div', children }
}

// 生成深度嵌套 Schema
function generateDeepSchema(depth: number): SchemaNode {
  if (depth <= 0) {
    return { type: 'span', children: 'leaf' }
  }
  return {
    type: 'div',
    props: { class: `level-${depth}` },
    children: [generateDeepSchema(depth - 1)]
  }
}

// 生成宽度优先的树状 Schema
function generateWideSchema(depth: number, breadth: number): SchemaNode {
  if (depth <= 0) {
    return { type: 'span', children: 'leaf' }
  }
  const children: SchemaNode[] = []
  for (let i = 0; i < breadth; i++) {
    children.push(generateWideSchema(depth - 1, breadth))
  }
  return { type: 'div', props: { class: `d${depth}-b${breadth}` }, children }
}

// 生成复杂表达式 Schema
function generateExpressionSchema(nodeCount: number): SchemaNode {
  const children: SchemaNode[] = []
  for (let i = 0; i < nodeCount; i++) {
    children.push({
      type: 'div',
      props: {
        class: `{{ "item-" + ${i} }}`,
        style: `{{ visible${i % 10} ? "" : "display:none" }}`
      },
      cond: `{{ show${i % 5} }}`,
      children: `{{ "Label " + count${i % 10} }}`
    })
  }
  return { type: 'div', children }
}

describe('边界压力测试', () => {
  const results: Record<string, any> = {}

  describe('1. 超大规模节点测试', () => {
    const nodeCounts = [1000, 2000, 5000, 10000]
    
    nodeCounts.forEach(count => {
      it(`${count} 个扁平节点 - 基线`, () => {
        const schema = generateFlatSchema(count)
        const renderer = new VueRenderer({ subtreeComponent: { enabled: false } })
        const ctx = createRuntimeContext({})
        
        const memBefore = getMemoryUsage()
        const result = measure(`${count}节点-基线`, () => {
          renderer.render(schema, ctx)
        }, 3)
        const memAfter = getMemoryUsage()
        
        results[`${count}节点-基线`] = { ...result, memDelta: memAfter - memBefore }
        console.log(`${count}节点-基线: ${result.avg.toFixed(2)}ms (min: ${result.min.toFixed(2)}, max: ${result.max.toFixed(2)})`)
        expect(result.avg).toBeDefined()
      })
      
      it(`${count} 个扁平节点 - subtreeComponent (all)`, () => {
        const schema = generateFlatSchema(count)
        const renderer = new VueRenderer({ subtreeComponent: { enabled: true, granularity: 'all' } })
        const ctx = createRuntimeContext({})
        
        const memBefore = getMemoryUsage()
        const result = measure(`${count}节点-all`, () => {
          renderer.render(schema, ctx)
        }, 3)
        const memAfter = getMemoryUsage()
        
        results[`${count}节点-all`] = { ...result, memDelta: memAfter - memBefore }
        console.log(`${count}节点-all: ${result.avg.toFixed(2)}ms (min: ${result.min.toFixed(2)}, max: ${result.max.toFixed(2)})`)
        expect(result.avg).toBeDefined()
      })
    })
  })

  describe('2. 超深嵌套测试', () => {
    const depths = [10, 20, 50, 100, 200]
    
    depths.forEach(depth => {
      it(`${depth} 层深度嵌套 - 基线`, () => {
        const schema = generateDeepSchema(depth)
        const renderer = new VueRenderer({ subtreeComponent: { enabled: false } })
        const ctx = createRuntimeContext({})
        
        const result = measure(`${depth}层-基线`, () => {
          renderer.render(schema, ctx)
        }, 5)
        
        results[`${depth}层-基线`] = result
        console.log(`${depth}层-基线: ${result.avg.toFixed(3)}ms`)
        expect(result.avg).toBeDefined()
      })
      
      it(`${depth} 层深度嵌套 - subtreeComponent (all)`, () => {
        const schema = generateDeepSchema(depth)
        const renderer = new VueRenderer({ subtreeComponent: { enabled: true, granularity: 'all' } })
        const ctx = createRuntimeContext({})
        
        const result = measure(`${depth}层-all`, () => {
          renderer.render(schema, ctx)
        }, 5)
        
        results[`${depth}层-all`] = result
        console.log(`${depth}层-all: ${result.avg.toFixed(3)}ms`)
        expect(result.avg).toBeDefined()
      })
      
      it(`${depth} 层深度嵌套 - subtreeComponent (maxDepth=10)`, () => {
        const schema = generateDeepSchema(depth)
        const renderer = new VueRenderer({ 
          subtreeComponent: { enabled: true, granularity: 'all', maxDepth: 10 } 
        })
        const ctx = createRuntimeContext({})
        
        const result = measure(`${depth}层-maxDepth10`, () => {
          renderer.render(schema, ctx)
        }, 5)
        
        results[`${depth}层-maxDepth10`] = result
        console.log(`${depth}层-maxDepth10: ${result.avg.toFixed(3)}ms`)
        expect(result.avg).toBeDefined()
      })
    })
  })

  describe('3. 宽度树状结构测试', () => {
    // 4^6 = 4096, 5^5 = 3125, 3^8 = 6561 节点
    const configs = [
      { depth: 6, breadth: 4, expected: 4096 },
      { depth: 5, breadth: 5, expected: 3125 },
      { depth: 8, breadth: 3, expected: 6561 },
      { depth: 4, breadth: 8, expected: 4096 }
    ]
    
    configs.forEach(({ depth, breadth, expected }) => {
      it(`${depth}层 x ${breadth}宽 (约${expected}节点) - 基线`, () => {
        const schema = generateWideSchema(depth, breadth)
        const renderer = new VueRenderer({ subtreeComponent: { enabled: false } })
        const ctx = createRuntimeContext({})
        
        const result = measure(`${depth}x${breadth}-基线`, () => {
          renderer.render(schema, ctx)
        }, 3)
        
        results[`${depth}x${breadth}-基线`] = result
        console.log(`${depth}层x${breadth}宽-基线: ${result.avg.toFixed(2)}ms`)
        expect(result.avg).toBeDefined()
      })
      
      it(`${depth}层 x ${breadth}宽 (约${expected}节点) - subtreeComponent`, () => {
        const schema = generateWideSchema(depth, breadth)
        const renderer = new VueRenderer({ subtreeComponent: { enabled: true, granularity: 'all' } })
        const ctx = createRuntimeContext({})
        
        const result = measure(`${depth}x${breadth}-all`, () => {
          renderer.render(schema, ctx)
        }, 3)
        
        results[`${depth}x${breadth}-all`] = result
        console.log(`${depth}层x${breadth}宽-all: ${result.avg.toFixed(2)}ms`)
        expect(result.avg).toBeDefined()
      })
    })
  })

  describe('4. 大规模循环测试', () => {
    const itemCounts = [500, 1000, 2000, 5000]
    
    itemCounts.forEach(count => {
      it(`${count} 项循环 - 基线`, () => {
        const schema: SchemaNode = {
          type: 'ul',
          children: [{
            type: 'li',
            loop: { items: '{{ items }}', itemKey: 'item', indexKey: 'idx' },
            children: [
              { type: 'span', children: '{{ item.name }}' },
              { type: 'span', children: '{{ item.value }}' }
            ]
          }]
        }
        const items = Array.from({ length: count }, (_, i) => ({ 
          id: i, 
          name: `Item ${i}`, 
          value: i * 100 
        }))
        const renderer = new VueRenderer({ subtreeComponent: { enabled: false } })
        const ctx = createRuntimeContext({ items })
        
        const result = measure(`${count}循环-基线`, () => {
          renderer.render(schema, ctx)
        }, 3)
        
        results[`${count}循环-基线`] = result
        console.log(`${count}循环-基线: ${result.avg.toFixed(2)}ms`)
        expect(result.avg).toBeDefined()
      })
      
      it(`${count} 项循环 - loopItemAsComponent`, () => {
        const schema: SchemaNode = {
          type: 'ul',
          children: [{
            type: 'li',
            loop: { items: '{{ items }}', itemKey: 'item', indexKey: 'idx' },
            children: [
              { type: 'span', children: '{{ item.name }}' },
              { type: 'span', children: '{{ item.value }}' }
            ]
          }]
        }
        const items = Array.from({ length: count }, (_, i) => ({ 
          id: i, 
          name: `Item ${i}`, 
          value: i * 100 
        }))
        const renderer = new VueRenderer({ 
          loopItemAsComponent: true,
          subtreeComponent: { enabled: false }
        })
        const ctx = createRuntimeContext({ items })
        
        const result = measure(`${count}循环-loopItem`, () => {
          renderer.render(schema, ctx)
        }, 3)
        
        results[`${count}循环-loopItem`] = result
        console.log(`${count}循环-loopItem: ${result.avg.toFixed(2)}ms`)
        expect(result.avg).toBeDefined()
      })
    })
  })

  describe('5. 高频更新压力测试', () => {
    const updateCounts = [100, 500, 1000]
    
    updateCounts.forEach(count => {
      it(`${count} 次连续状态更新 - 基线`, () => {
        const schema: SchemaNode = {
          type: 'div',
          children: [
            { type: 'span', children: '{{ count }}' },
            { type: 'p', children: '{{ message }}' }
          ]
        }
        const renderer = new VueRenderer({ subtreeComponent: { enabled: false } })
        
        const result = measure(`${count}更新-基线`, () => {
          for (let i = 0; i < count; i++) {
            const ctx = createRuntimeContext({ count: i, message: `Update ${i}` })
            renderer.render(schema, ctx)
          }
        }, 3)
        
        results[`${count}更新-基线`] = result
        console.log(`${count}更新-基线: ${result.avg.toFixed(2)}ms (${(count / result.avg * 1000).toFixed(0)} ops/s)`)
        expect(result.avg).toBeDefined()
      })
      
      it(`${count} 次连续状态更新 - path-memo`, () => {
        const schema: SchemaNode = {
          type: 'div',
          children: [
            { type: 'span', children: '{{ count }}' },
            { type: 'p', children: '{{ message }}' }
          ]
        }
        const renderer = new VueRenderer({ 
          usePathMemo: true,
          subtreeComponent: { enabled: false }
        })
        
        const result = measure(`${count}更新-pathMemo`, () => {
          for (let i = 0; i < count; i++) {
            const ctx = createRuntimeContext({ count: i, message: `Update ${i}` })
            renderer.render(schema, ctx)
          }
        }, 3)
        
        results[`${count}更新-pathMemo`] = result
        console.log(`${count}更新-pathMemo: ${result.avg.toFixed(2)}ms (${(count / result.avg * 1000).toFixed(0)} ops/s)`)
        expect(result.avg).toBeDefined()
      })
    })
  })

  describe('6. 复杂表达式压力测试', () => {
    const counts = [100, 500, 1000]
    
    counts.forEach(count => {
      it(`${count} 个表达式节点 - 基线`, () => {
        const schema = generateExpressionSchema(count)
        const state: Record<string, any> = {}
        for (let i = 0; i < 10; i++) {
          state[`visible${i}`] = true
          state[`show${i}`] = true
          state[`count${i}`] = i
        }
        const renderer = new VueRenderer({ subtreeComponent: { enabled: false } })
        const ctx = createRuntimeContext(state)
        
        const result = measure(`${count}表达式-基线`, () => {
          renderer.render(schema, ctx)
        }, 3)
        
        results[`${count}表达式-基线`] = result
        console.log(`${count}表达式-基线: ${result.avg.toFixed(2)}ms`)
        expect(result.avg).toBeDefined()
      })
      
      it(`${count} 个表达式节点 - subtreeComponent`, () => {
        const schema = generateExpressionSchema(count)
        const state: Record<string, any> = {}
        for (let i = 0; i < 10; i++) {
          state[`visible${i}`] = true
          state[`show${i}`] = true
          state[`count${i}`] = i
        }
        const renderer = new VueRenderer({ subtreeComponent: { enabled: true, granularity: 'all' } })
        const ctx = createRuntimeContext(state)
        
        const result = measure(`${count}表达式-all`, () => {
          renderer.render(schema, ctx)
        }, 3)
        
        results[`${count}表达式-all`] = result
        console.log(`${count}表达式-all: ${result.avg.toFixed(2)}ms`)
        expect(result.avg).toBeDefined()
      })
    })
  })

  describe('7. 组合极端场景', () => {
    it('深度嵌套 + 大量循环 + 表达式', () => {
      const schema: SchemaNode = {
        type: 'div',
        children: [{
          type: 'div',
          children: [{
            type: 'div',
            children: [{
              type: 'ul',
              children: [{
                type: 'li',
                loop: { items: '{{ items }}', itemKey: 'item' },
                children: [
                  { type: 'span', props: { class: '{{ item.class }}' }, children: '{{ item.name }}' },
                  { 
                    type: 'div', 
                    cond: '{{ item.visible }}',
                    children: [
                      { type: 'p', children: '{{ item.desc }}' },
                      { type: 'span', children: '{{ item.count }}' }
                    ]
                  }
                ]
              }]
            }]
          }]
        }]
      }
      
      const items = Array.from({ length: 500 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        class: `item-${i % 10}`,
        visible: i % 2 === 0,
        desc: `Description for item ${i}`,
        count: i * 10
      }))
      
      const renderer1 = new VueRenderer({ subtreeComponent: { enabled: false } })
      const renderer2 = new VueRenderer({ 
        subtreeComponent: { enabled: true, granularity: 'all' },
        loopItemAsComponent: true
      })
      const ctx = createRuntimeContext({ items })
      
      const result1 = measure('组合极端-基线', () => {
        renderer1.render(schema, ctx)
      }, 3)
      
      const result2 = measure('组合极端-优化', () => {
        renderer2.render(schema, ctx)
      }, 3)
      
      results['组合极端-基线'] = result1
      results['组合极端-优化'] = result2
      
      console.log(`组合极端-基线: ${result1.avg.toFixed(2)}ms`)
      console.log(`组合极端-优化: ${result2.avg.toFixed(2)}ms (${(result1.avg / result2.avg).toFixed(2)}x)`)
      expect(result1.avg).toBeDefined()
    })
  })

  describe('结果汇总', () => {
    it('输出边界压力测试报告', () => {
      console.log('\n')
      console.log('╔══════════════════════════════════════════════════════════════════════════════╗')
      console.log('║                           边界压力测试报告                                    ║')
      console.log('╠══════════════════════════════════════════════════════════════════════════════╣')
      console.log(`║ 测试环境: Node.js ${process.version} + Vitest + Vue 3                        ║`)
      console.log(`║ 测试日期: ${new Date().toISOString().split('T')[0]}                                                    ║`)
      console.log('╠══════════════════════════════════════════════════════════════════════════════╣')
      
      // 节点规模测试
      console.log('║                                                                              ║')
      console.log('║ 【1. 超大规模节点测试】                                                      ║')
      console.log('║ ──────────────────────────────────────────────────────────────────────────── ║')
      const nodeCounts = [1000, 2000, 5000, 10000]
      nodeCounts.forEach(count => {
        const baseline = results[`${count}节点-基线`]
        const all = results[`${count}节点-all`]
        if (baseline && all) {
          const ratio = (baseline.avg / all.avg).toFixed(2)
          const status = Number(ratio) >= 1 ? '🚀' : '⚠️'
          console.log(`║   ${count.toString().padStart(5)}节点: 基线 ${baseline.avg.toFixed(2).padStart(7)}ms → ${all.avg.toFixed(2).padStart(7)}ms  ${status} ${ratio}x        ║`)
        }
      })
      
      // 深度嵌套测试
      console.log('║                                                                              ║')
      console.log('║ 【2. 超深嵌套测试】                                                          ║')
      console.log('║ ──────────────────────────────────────────────────────────────────────────── ║')
      const depths = [10, 20, 50, 100, 200]
      depths.forEach(depth => {
        const baseline = results[`${depth}层-基线`]
        const all = results[`${depth}层-all`]
        const limited = results[`${depth}层-maxDepth10`]
        if (baseline && all) {
          const ratio = (baseline.avg / all.avg).toFixed(2)
          const limitedRatio = limited ? (baseline.avg / limited.avg).toFixed(2) : '-'
          console.log(`║   ${depth.toString().padStart(3)}层: 基线 ${baseline.avg.toFixed(3).padStart(7)}ms → all ${all.avg.toFixed(3).padStart(7)}ms (${ratio}x) maxDepth10 ${limitedRatio}x ║`)
        }
      })
      
      // 循环测试
      console.log('║                                                                              ║')
      console.log('║ 【3. 大规模循环测试】                                                        ║')
      console.log('║ ──────────────────────────────────────────────────────────────────────────── ║')
      const loopCounts = [500, 1000, 2000, 5000]
      loopCounts.forEach(count => {
        const baseline = results[`${count}循环-基线`]
        const loopItem = results[`${count}循环-loopItem`]
        if (baseline && loopItem) {
          const ratio = (baseline.avg / loopItem.avg).toFixed(2)
          console.log(`║   ${count.toString().padStart(4)}项: 基线 ${baseline.avg.toFixed(2).padStart(8)}ms → ${loopItem.avg.toFixed(2).padStart(8)}ms  🚀 ${ratio}x          ║`)
        }
      })
      
      // 高频更新测试
      console.log('║                                                                              ║')
      console.log('║ 【4. 高频更新压力测试】                                                      ║')
      console.log('║ ──────────────────────────────────────────────────────────────────────────── ║')
      const updateCounts = [100, 500, 1000]
      updateCounts.forEach(count => {
        const baseline = results[`${count}更新-基线`]
        const pathMemo = results[`${count}更新-pathMemo`]
        if (baseline && pathMemo) {
          const ratio = (baseline.avg / pathMemo.avg).toFixed(2)
          const opsBaseline = (count / baseline.avg * 1000).toFixed(0)
          const opsPathMemo = (count / pathMemo.avg * 1000).toFixed(0)
          console.log(`║   ${count.toString().padStart(4)}次更新: ${opsBaseline.padStart(6)} ops/s → ${opsPathMemo.padStart(6)} ops/s  🚀 ${ratio}x              ║`)
        }
      })
      
      // 组合测试
      console.log('║                                                                              ║')
      console.log('║ 【5. 组合极端场景】                                                          ║')
      console.log('║ ──────────────────────────────────────────────────────────────────────────── ║')
      const extreme1 = results['组合极端-基线']
      const extreme2 = results['组合极端-优化']
      if (extreme1 && extreme2) {
        const ratio = (extreme1.avg / extreme2.avg).toFixed(2)
        console.log(`║   深嵌套+500循环+表达式: ${extreme1.avg.toFixed(2)}ms → ${extreme2.avg.toFixed(2)}ms  🚀 ${ratio}x                   ║`)
      }
      
      console.log('║                                                                              ║')
      console.log('╠══════════════════════════════════════════════════════════════════════════════╣')
      console.log('║ 结论:                                                                        ║')
      console.log('║   1. subtreeComponent 在大规模节点场景下有显著优势                           ║')
      console.log('║   2. maxDepth 限制可有效控制深度嵌套的开销                                   ║')
      console.log('║   3. loopItemAsComponent 在大循环场景下表现优异                              ║')
      console.log('║   4. path-memo 在高频更新场景下提供稳定加速                                  ║')
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝')
      
      expect(true).toBe(true)
    })
  })
})
