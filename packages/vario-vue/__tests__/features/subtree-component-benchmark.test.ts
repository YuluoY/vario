/**
 * 方案 C/D 集成性能对比测试
 * 
 * 测试目的：验证 subtreeComponent 和 schemaFragment 集成到渲染流后的真实性能差异
 * 
 * 对比：
 * - subtreeComponent.enabled = false (基线)
 * - subtreeComponent.enabled = true, granularity = 'all'
 * - subtreeComponent.enabled = true, granularity = 'boundary'
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { VueRenderer } from '../../src/renderer'
import { createRuntimeContext } from '@variojs/core'
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

describe('方案C/D 集成性能对比', () => {
  const results: Record<string, { avg: number; total: number }> = {}
  
  describe('1. 深度嵌套 Schema 渲染', () => {
    // 生成 5 层深度，每层 3 个子节点 = 3^5 = 243 个节点
    const deepSchema = generateDeepSchema(5, 3)
    
    it('基线：subtreeComponent.enabled = false', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: false }
      })
      const ctx = createRuntimeContext({})
      
      const result = measure('深度嵌套-基线', () => {
        renderer.render(deepSchema, ctx)
      }, 20)
      
      results['深度嵌套-基线'] = result
      console.log(`深度嵌套-基线: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
    
    it('方案C (granularity=all)：所有节点组件化', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'all' }
      })
      const ctx = createRuntimeContext({})
      
      const result = measure('深度嵌套-all', () => {
        renderer.render(deepSchema, ctx)
      }, 20)
      
      results['深度嵌套-all'] = result
      console.log(`深度嵌套-all: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
    
    it('方案C (granularity=boundary)：仅边界节点组件化', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'boundary' }
      })
      const ctx = createRuntimeContext({})
      
      const result = measure('深度嵌套-boundary', () => {
        renderer.render(deepSchema, ctx)
      }, 20)
      
      results['深度嵌套-boundary'] = result
      console.log(`深度嵌套-boundary: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
  })
  
  describe('2. 边界组件 Schema 渲染', () => {
    // 交替使用原生元素和自定义组件的 10 层嵌套
    const boundarySchema = generateBoundarySchema(10)
    
    it('基线：subtreeComponent.enabled = false', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: false },
        components: { MyButton: { template: '<button><slot/></button>' } }
      })
      const ctx = createRuntimeContext({})
      
      const result = measure('边界组件-基线', () => {
        renderer.render(boundarySchema, ctx)
      }, 30)
      
      results['边界组件-基线'] = result
      console.log(`边界组件-基线: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
    
    it('方案C (granularity=boundary)：仅边界节点组件化', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'boundary' },
        components: { MyButton: { template: '<button><slot/></button>' } }
      })
      const ctx = createRuntimeContext({})
      
      const result = measure('边界组件-boundary', () => {
        renderer.render(boundarySchema, ctx)
      }, 30)
      
      results['边界组件-boundary'] = result
      console.log(`边界组件-boundary: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
  })
  
  describe('3. 列表渲染对比', () => {
    const listSchema = generateListSchema(100)
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }))
    
    it('基线：subtreeComponent.enabled = false', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: false }
      })
      const ctx = createRuntimeContext({ items })
      
      const result = measure('列表100项-基线', () => {
        renderer.render(listSchema, ctx)
      }, 20)
      
      results['列表100项-基线'] = result
      console.log(`列表100项-基线: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
    
    it('方案C (granularity=all)', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'all' }
      })
      const ctx = createRuntimeContext({ items })
      
      const result = measure('列表100项-all', () => {
        renderer.render(listSchema, ctx)
      }, 20)
      
      results['列表100项-all'] = result
      console.log(`列表100项-all: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
  })
  
  describe('4. 重复渲染性能（模拟状态更新）', () => {
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
    
    it('基线：10次重复渲染', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: false }
      })
      
      const result = measure('重复渲染10次-基线', () => {
        for (let i = 0; i < 10; i++) {
          const ctx = createRuntimeContext({ count: i, name: `Name ${i}` })
          renderer.render(schema, ctx)
        }
      }, 10)
      
      results['重复渲染10次-基线'] = result
      console.log(`重复渲染10次-基线: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
    
    it('方案C (granularity=all)：10次重复渲染', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'all' }
      })
      
      const result = measure('重复渲染10次-all', () => {
        for (let i = 0; i < 10; i++) {
          const ctx = createRuntimeContext({ count: i, name: `Name ${i}` })
          renderer.render(schema, ctx)
        }
      }, 10)
      
      results['重复渲染10次-all'] = result
      console.log(`重复渲染10次-all: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
  })
  
  describe('5. maxDepth 限制测试', () => {
    const deepSchema = generateDeepSchema(8, 2) // 2^8 = 256 节点
    
    it('无深度限制', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'all' }
      })
      const ctx = createRuntimeContext({})
      
      const result = measure('8层深度-无限制', () => {
        renderer.render(deepSchema, ctx)
      }, 20)
      
      results['8层深度-无限制'] = result
      console.log(`8层深度-无限制: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
    
    it('maxDepth=3', () => {
      const renderer = new VueRenderer({
        subtreeComponent: { enabled: true, granularity: 'all', maxDepth: 3 }
      })
      const ctx = createRuntimeContext({})
      
      const result = measure('8层深度-maxDepth3', () => {
        renderer.render(deepSchema, ctx)
      }, 20)
      
      results['8层深度-maxDepth3'] = result
      console.log(`8层深度-maxDepth3: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
  })
  
  describe('6. 与 path-memo 组合测试', () => {
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
    
    it('仅 path-memo', () => {
      const renderer = new VueRenderer({
        usePathMemo: true,
        subtreeComponent: { enabled: false }
      })
      const ctx = createRuntimeContext({})
      
      // 首次渲染填充缓存
      renderer.render(schema, ctx)
      
      const result = measure('150节点-仅pathMemo', () => {
        renderer.render(schema, ctx)
      }, 20)
      
      results['150节点-仅pathMemo'] = result
      console.log(`150节点-仅pathMemo: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
    
    it('仅 subtreeComponent', () => {
      const renderer = new VueRenderer({
        usePathMemo: false,
        subtreeComponent: { enabled: true, granularity: 'all' }
      })
      const ctx = createRuntimeContext({})
      
      const result = measure('150节点-仅subtree', () => {
        renderer.render(schema, ctx)
      }, 20)
      
      results['150节点-仅subtree'] = result
      console.log(`150节点-仅subtree: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
    
    it('path-memo + subtreeComponent', () => {
      const renderer = new VueRenderer({
        usePathMemo: true,
        subtreeComponent: { enabled: true, granularity: 'all' }
      })
      const ctx = createRuntimeContext({})
      
      // 首次渲染填充缓存
      renderer.render(schema, ctx)
      
      const result = measure('150节点-组合', () => {
        renderer.render(schema, ctx)
      }, 20)
      
      results['150节点-组合'] = result
      console.log(`150节点-组合: ${result.avg.toFixed(2)}ms`)
      expect(result.avg).toBeDefined()
    })
  })
  
  describe('结果汇总', () => {
    it('输出对比结果', () => {
      console.log('\n')
      console.log('╔════════════════════════════════════════════════════════════════════════╗')
      console.log('║                    方案C/D 集成性能对比结果                              ║')
      console.log('╠════════════════════════════════════════════════════════════════════════╣')
      console.log('║ 测试环境: Node.js + Vitest + Vue 3                                     ║')
      console.log(`║ 测试日期: ${new Date().toISOString().split('T')[0]}                                              ║`)
      console.log('╠════════════════════════════════════════════════════════════════════════╣')
      
      // 深度嵌套对比
      if (results['深度嵌套-基线'] && results['深度嵌套-all']) {
        const baseline = results['深度嵌套-基线'].avg
        const all = results['深度嵌套-all'].avg
        const boundary = results['深度嵌套-boundary']?.avg || 0
        const allRatio = (baseline / all).toFixed(2)
        const boundaryRatio = boundary ? (baseline / boundary).toFixed(2) : '-'
        
        console.log('║                                                                        ║')
        console.log('║ 【深度嵌套 Schema (243节点, 5层)】                                      ║')
        console.log('║ ─────────────────────────────────────────────────────────────────────  ║')
        console.log(`║   基线 (enabled=false):    ${baseline.toFixed(2).padStart(6)}ms                                  ║`)
        console.log(`║   granularity=all:         ${all.toFixed(2).padStart(6)}ms  (${allRatio}x)                           ║`)
        console.log(`║   granularity=boundary:    ${boundary.toFixed(2).padStart(6)}ms  (${boundaryRatio}x)                           ║`)
      }
      
      // 边界组件对比
      if (results['边界组件-基线'] && results['边界组件-boundary']) {
        const baseline = results['边界组件-基线'].avg
        const boundary = results['边界组件-boundary'].avg
        const ratio = (baseline / boundary).toFixed(2)
        
        console.log('║                                                                        ║')
        console.log('║ 【边界组件 Schema (10层交替)】                                          ║')
        console.log('║ ─────────────────────────────────────────────────────────────────────  ║')
        console.log(`║   基线 (enabled=false):    ${baseline.toFixed(2).padStart(6)}ms                                  ║`)
        console.log(`║   granularity=boundary:    ${boundary.toFixed(2).padStart(6)}ms  (${ratio}x)                           ║`)
      }
      
      // 列表渲染对比
      if (results['列表100项-基线'] && results['列表100项-all']) {
        const baseline = results['列表100项-基线'].avg
        const all = results['列表100项-all'].avg
        const ratio = (baseline / all).toFixed(2)
        
        console.log('║                                                                        ║')
        console.log('║ 【列表渲染 (100项)】                                                    ║')
        console.log('║ ─────────────────────────────────────────────────────────────────────  ║')
        console.log(`║   基线 (enabled=false):    ${baseline.toFixed(2).padStart(6)}ms                                  ║`)
        console.log(`║   granularity=all:         ${all.toFixed(2).padStart(6)}ms  (${ratio}x)                           ║`)
      }
      
      // 重复渲染对比
      if (results['重复渲染10次-基线'] && results['重复渲染10次-all']) {
        const baseline = results['重复渲染10次-基线'].avg
        const all = results['重复渲染10次-all'].avg
        const ratio = (baseline / all).toFixed(2)
        
        console.log('║                                                                        ║')
        console.log('║ 【重复渲染 (10次状态更新)】                                             ║')
        console.log('║ ─────────────────────────────────────────────────────────────────────  ║')
        console.log(`║   基线 (enabled=false):    ${baseline.toFixed(2).padStart(6)}ms                                  ║`)
        console.log(`║   granularity=all:         ${all.toFixed(2).padStart(6)}ms  (${ratio}x)                           ║`)
      }
      
      // maxDepth 对比
      if (results['8层深度-无限制'] && results['8层深度-maxDepth3']) {
        const noLimit = results['8层深度-无限制'].avg
        const limited = results['8层深度-maxDepth3'].avg
        const ratio = (noLimit / limited).toFixed(2)
        
        console.log('║                                                                        ║')
        console.log('║ 【maxDepth 限制效果 (8层256节点)】                                      ║')
        console.log('║ ─────────────────────────────────────────────────────────────────────  ║')
        console.log(`║   无深度限制:              ${noLimit.toFixed(2).padStart(6)}ms                                  ║`)
        console.log(`║   maxDepth=3:              ${limited.toFixed(2).padStart(6)}ms  (${ratio}x)                           ║`)
      }
      
      // 组合优化对比
      if (results['150节点-仅pathMemo'] && results['150节点-仅subtree'] && results['150节点-组合']) {
        const pathMemo = results['150节点-仅pathMemo'].avg
        const subtree = results['150节点-仅subtree'].avg
        const combined = results['150节点-组合'].avg
        
        console.log('║                                                                        ║')
        console.log('║ 【组合优化效果 (150节点)】                                              ║')
        console.log('║ ─────────────────────────────────────────────────────────────────────  ║')
        console.log(`║   仅 path-memo:            ${pathMemo.toFixed(2).padStart(6)}ms                                  ║`)
        console.log(`║   仅 subtreeComponent:     ${subtree.toFixed(2).padStart(6)}ms                                  ║`)
        console.log(`║   path-memo + subtree:     ${combined.toFixed(2).padStart(6)}ms                                  ║`)
      }
      
      console.log('║                                                                        ║')
      console.log('╠════════════════════════════════════════════════════════════════════════╣')
      console.log('║ 说明：                                                                 ║')
      console.log('║   - 比值 > 1 表示优化后更快                                            ║')
      console.log('║   - 比值 < 1 表示优化后更慢（有额外开销）                              ║')
      console.log('║   - 方案C 主要优势在 Vue 运行时的 diff 阶段，而非初始渲染               ║')
      console.log('╚════════════════════════════════════════════════════════════════════════╝')
      
      expect(true).toBe(true)
    })
  })
})
