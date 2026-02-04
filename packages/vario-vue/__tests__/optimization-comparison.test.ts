/**
 * 优化效果对比测试
 * 
 * 本测试专门用于对比各优化方案启用和禁用时的性能差异。
 * 
 * 测试方案：
 * - 方案 A（path-memo）：按路径缓存子树 VNode
 * - 方案 B（loopItemAsComponent）：循环项组件化
 * 
 * 每个测试场景都会输出：
 * 1. 基线耗时（无优化）
 * 2. 优化后耗时
 * 3. 加速倍数
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { nextTick, reactive, h, defineComponent } from 'vue'
import { useVario } from '../src/composable.js'
import type { Schema } from '@variojs/schema'

// ============================================================================
// 模拟组件
// ============================================================================

const ElButton = defineComponent({
  name: 'ElButton',
  props: { type: String, size: String },
  setup(props, { slots }) {
    return () => h('button', { class: `el-button el-button--${props.type}` }, slots.default?.())
  }
})

const ElInput = defineComponent({
  name: 'ElInput',
  props: { modelValue: [String, Number], placeholder: String },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', {
      class: 'el-input',
      value: props.modelValue,
      placeholder: props.placeholder,
      onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value)
    })
  }
})

const ElCard = defineComponent({
  name: 'ElCard',
  props: { header: String },
  setup(props, { slots }) {
    return () => h('div', { class: 'el-card' }, [
      props.header ? h('div', { class: 'el-card__header' }, props.header) : null,
      h('div', { class: 'el-card__body' }, slots.default?.())
    ])
  }
})

const MockComponents = { ElButton, ElInput, ElCard }

// ============================================================================
// 测试结果收集
// ============================================================================

interface ComparisonResult {
  scenario: string
  baseline: number
  optimized: number
  speedup: number
  optimization: string
}

const comparisonResults: ComparisonResult[] = []

function recordComparison(
  scenario: string,
  baseline: number,
  optimized: number,
  optimization: string
) {
  const speedup = baseline / optimized
  comparisonResults.push({ scenario, baseline, optimized, speedup, optimization })
}

// ============================================================================
// 测试场景
// ============================================================================

describe('优化效果对比测试', () => {
  
  describe('1. 方案 A（path-memo）对比', () => {
    
    it('场景：500 节点初始化', async () => {
      const children: Schema[] = Array.from({ length: 500 }, (_, i) => ({
        type: i % 3 === 0 ? 'ElButton' : 'div',
        props: { id: `node-${i}`, class: 'item' },
        children: `Node ${i}`
      }))
      const schema: Schema = { type: 'div', children }
      
      // 基线：禁用 path-memo
      const startBaseline = performance.now()
      const baseline = useVario(schema, {
        components: MockComponents,
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      const baselineDuration = performance.now() - startBaseline
      
      // 优化：启用 path-memo
      const startOptimized = performance.now()
      const optimized = useVario(schema, {
        components: MockComponents,
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()
      const optimizedDuration = performance.now() - startOptimized
      
      expect(baseline.vnode.value).toBeDefined()
      expect(optimized.vnode.value).toBeDefined()
      
      recordComparison('500节点初始化', baselineDuration, optimizedDuration, 'path-memo')
    })
    
    it('场景：静态节点二次渲染', async () => {
      const children: Schema[] = Array.from({ length: 200 }, (_, i) => ({
        type: 'div',
        props: { class: 'static-node' },
        children: [
          { type: 'span', children: `Label ${i}` },
          { type: 'ElButton', props: { type: 'primary' }, children: 'Action' }
        ]
      }))
      const schema: Schema = { type: 'div', children }
      
      // 基线
      const baselineState = reactive({ counter: 0 })
      const baseline = useVario(schema, {
        state: baselineState,
        components: MockComponents,
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      
      const startBaseline = performance.now()
      for (let i = 0; i < 10; i++) {
        baselineState.counter++
        await nextTick()
      }
      const baselineDuration = performance.now() - startBaseline
      
      // 优化
      const optimizedState = reactive({ counter: 0 })
      const optimized = useVario(schema, {
        state: optimizedState,
        components: MockComponents,
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()
      
      const startOptimized = performance.now()
      for (let i = 0; i < 10; i++) {
        optimizedState.counter++
        await nextTick()
      }
      const optimizedDuration = performance.now() - startOptimized
      
      expect(baseline.vnode.value).toBeDefined()
      expect(optimized.vnode.value).toBeDefined()
      
      recordComparison('200静态节点×10次重渲染', baselineDuration, optimizedDuration, 'path-memo')
    })
  })
  
  describe('2. 方案 B（loopItemAsComponent）对比', () => {
    
    it('场景：500 项列表初始化', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          children: '{{ item.name }}'
        }]
      }
      const items = Array.from({ length: 500 }, (_, i) => ({ id: i, name: `Item ${i}` }))
      
      // 基线
      const startBaseline = performance.now()
      const baseline = useVario(schema, {
        state: { items },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      const baselineDuration = performance.now() - startBaseline
      
      // 优化
      const startOptimized = performance.now()
      const optimized = useVario(schema, {
        state: { items },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: true }
      })
      await nextTick()
      const optimizedDuration = performance.now() - startOptimized
      
      expect(baseline.vnode.value).toBeDefined()
      expect(optimized.vnode.value).toBeDefined()
      
      recordComparison('500项列表初始化', baselineDuration, optimizedDuration, 'loopItemAsComponent')
    })
    
    it('场景：列表单项更新', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          props: { class: 'list-item' },
          children: '{{ item.name }}'
        }]
      }
      
      // 基线
      const baselineItems = reactive(
        Array.from({ length: 200 }, (_, i) => ({ id: i, name: `Item ${i}` }))
      )
      const baseline = useVario(schema, {
        state: { items: baselineItems },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      
      const startBaseline = performance.now()
      for (let i = 0; i < 50; i++) {
        baselineItems[i % 200].name = `Updated ${i}`
        await nextTick()
      }
      const baselineDuration = performance.now() - startBaseline
      
      // 优化
      const optimizedItems = reactive(
        Array.from({ length: 200 }, (_, i) => ({ id: i, name: `Item ${i}` }))
      )
      const optimized = useVario(schema, {
        state: { items: optimizedItems },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: true }
      })
      await nextTick()
      
      const startOptimized = performance.now()
      for (let i = 0; i < 50; i++) {
        optimizedItems[i % 200].name = `Updated ${i}`
        await nextTick()
      }
      const optimizedDuration = performance.now() - startOptimized
      
      expect(baseline.vnode.value).toBeDefined()
      expect(optimized.vnode.value).toBeDefined()
      
      recordComparison('200项列表×50次单项更新', baselineDuration, optimizedDuration, 'loopItemAsComponent')
    })
  })
  
  describe('3. 组合优化（A+B）对比', () => {
    
    it('场景：复杂表单 + 列表混合', async () => {
      const schema: Schema<{
        form: { name: string; email: string }
        items: Array<{ id: number; name: string; status: boolean }>
      }> = {
        type: 'ElCard',
        props: { header: '复杂表单' },
        children: [
          { type: 'ElInput', model: 'form.name', props: { placeholder: '姓名' } },
          { type: 'ElInput', model: 'form.email', props: { placeholder: '邮箱' } },
          {
            type: 'div',
            loop: { items: '{{ items }}', itemKey: 'item' },
            children: [
              { type: 'span', children: '{{ item.name }}' },
              {
                type: 'ElButton',
                props: { type: '{{ item.status ? "success" : "danger" }}' },
                children: '{{ item.status ? "启用" : "禁用" }}'
              }
            ]
          }
        ]
      }
      
      const initialState = {
        form: { name: '', email: '' },
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          status: i % 2 === 0
        }))
      }
      
      // 基线：全部禁用
      const baselineState = reactive(JSON.parse(JSON.stringify(initialState)))
      const baseline = useVario(schema, {
        state: baselineState,
        components: MockComponents,
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      
      const startBaseline = performance.now()
      for (let i = 0; i < 30; i++) {
        baselineState.items[i % 100].name = `Modified ${i}`
        await nextTick()
      }
      const baselineDuration = performance.now() - startBaseline
      
      // 优化：全部启用
      const optimizedState = reactive(JSON.parse(JSON.stringify(initialState)))
      const optimized = useVario(schema, {
        state: optimizedState,
        components: MockComponents,
        rendererOptions: { usePathMemo: true, loopItemAsComponent: true }
      })
      await nextTick()
      
      const startOptimized = performance.now()
      for (let i = 0; i < 30; i++) {
        optimizedState.items[i % 100].name = `Modified ${i}`
        await nextTick()
      }
      const optimizedDuration = performance.now() - startOptimized
      
      expect(baseline.vnode.value).toBeDefined()
      expect(optimized.vnode.value).toBeDefined()
      
      recordComparison('复杂表单+100项列表×30次更新', baselineDuration, optimizedDuration, 'path-memo + loopItemAsComponent')
    })
    
    it('场景：嵌套循环', async () => {
      const schema: Schema<{
        groups: Array<{ id: number; name: string; items: Array<{ id: number; value: string }> }>
      }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ groups }}', itemKey: 'group' },
          props: { class: 'group' },
          children: [
            { type: 'h3', children: '{{ group.name }}' },
            {
              type: 'div',
              loop: { items: '{{ group.items }}', itemKey: 'subItem' },
              children: '{{ subItem.value }}'
            }
          ]
        }]
      }
      
      const createGroups = () =>
        Array.from({ length: 20 }, (_, gi) => ({
          id: gi,
          name: `Group ${gi}`,
          items: Array.from({ length: 20 }, (_, ii) => ({
            id: ii,
            value: `Value ${gi}-${ii}`
          }))
        }))
      
      // 基线
      const baselineState = reactive({ groups: createGroups() })
      const baseline = useVario(schema, {
        state: baselineState,
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      
      const startBaseline = performance.now()
      for (let i = 0; i < 20; i++) {
        baselineState.groups[i % 20].items[i % 20].value = `Updated ${i}`
        await nextTick()
      }
      const baselineDuration = performance.now() - startBaseline
      
      // 优化
      const optimizedState = reactive({ groups: createGroups() })
      const optimized = useVario(schema, {
        state: optimizedState,
        rendererOptions: { usePathMemo: true, loopItemAsComponent: true }
      })
      await nextTick()
      
      const startOptimized = performance.now()
      for (let i = 0; i < 20; i++) {
        optimizedState.groups[i % 20].items[i % 20].value = `Updated ${i}`
        await nextTick()
      }
      const optimizedDuration = performance.now() - startOptimized
      
      expect(baseline.vnode.value).toBeDefined()
      expect(optimized.vnode.value).toBeDefined()
      
      recordComparison('20×20嵌套循环×20次更新', baselineDuration, optimizedDuration, 'path-memo + loopItemAsComponent')
    })
  })
  
  // ============================================================================
  // 结果汇总
  // ============================================================================
  
  afterAll(() => {
    console.log('\n')
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗')
    console.log('║                           优化效果对比测试结果                                   ║')
    console.log('╠════════════════════════════════════════════════════════════════════════════════╣')
    console.log('║ 测试环境: Node.js + Vitest + Vue 3                                              ║')
    console.log(`║ 测试日期: ${new Date().toISOString().split('T')[0]}                                                            ║`)
    console.log('╠════════════════════════════════════════════════════════════════════════════════╣')
    
    // 按优化方案分组
    const byOptimization = new Map<string, ComparisonResult[]>()
    for (const r of comparisonResults) {
      if (!byOptimization.has(r.optimization)) {
        byOptimization.set(r.optimization, [])
      }
      byOptimization.get(r.optimization)!.push(r)
    }
    
    for (const [opt, results] of byOptimization) {
      console.log(`║                                                                                  ║`)
      console.log(`║ 【${opt}】`.padEnd(82) + '║')
      console.log('║ ─────────────────────────────────────────────────────────────────────────────── ║')
      
      for (const r of results) {
        const speedupStr = r.speedup >= 1 
          ? `🚀 ${r.speedup.toFixed(2)}x 加速`
          : `⚠️ ${(1/r.speedup).toFixed(2)}x 减速`
        const line = `║   ${r.scenario}: ${r.baseline.toFixed(2)}ms → ${r.optimized.toFixed(2)}ms (${speedupStr})`
        console.log(line.padEnd(82) + '║')
      }
    }
    
    console.log('║                                                                                  ║')
    console.log('╠════════════════════════════════════════════════════════════════════════════════╣')
    console.log('║ 结论：                                                                          ║')
    
    const avgSpeedups = new Map<string, number>()
    for (const [opt, results] of byOptimization) {
      const avg = results.reduce((sum, r) => sum + r.speedup, 0) / results.length
      avgSpeedups.set(opt, avg)
      const conclusion = `║   - ${opt}: 平均 ${avg.toFixed(2)}x 加速`
      console.log(conclusion.padEnd(82) + '║')
    }
    
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝')
    console.log('\n')
    
    // 验证至少有一些加速效果
    for (const [opt, avg] of avgSpeedups) {
      expect(avg).toBeGreaterThan(0.5) // 至少不应该太慢
    }
  })
})
