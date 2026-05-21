/**
 * Vario Vue 渲染性能综合基准测试
 *
 * 本测试模拟真实场景：逐步增大 schema 规模，覆盖初始渲染、响应式更新、
 * loop 项更新、多层嵌套子树局部更新等关键路径。
 *
 * 运行方式（独立文件）：
 *   pnpm --filter @variojs/vue vitest run __tests__/comprehensive-perf-report.test.ts
 */

import { describe, it, expect, afterAll } from 'vitest'
import { nextTick, h, defineComponent } from 'vue'
import { useVario } from '../src/composable.js'
import type { Schema } from '@variojs/schema'

// ============================================================================
// 模拟真实 Element Plus 组件
// ============================================================================

const ElButton = defineComponent({
  name: 'ElButton',
  props: {
    type: { type: String, default: 'default' },
    size: { type: String, default: 'default' },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => h('button', {
      class: ['el-button', `el-button--${props.type}`, `el-button--${props.size}`],
      disabled: props.disabled || props.loading,
    }, slots.default?.())
  },
})

const ElInput = defineComponent({
  name: 'ElInput',
  props: {
    modelValue: { type: [String, Number], default: '' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    clearable: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('div', { class: 'el-input' }, [
      h('input', {
        class: 'el-input__inner',
        value: props.modelValue,
        placeholder: props.placeholder,
        disabled: props.disabled,
        onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
      }),
    ])
  },
})

const ElCard = defineComponent({
  name: 'ElCard',
  props: { header: { type: String, default: '' }, shadow: { type: String, default: 'always' } },
  setup(props, { slots }) {
    return () => h('div', { class: ['el-card', `is-${props.shadow}-shadow`] }, [
      props.header ? h('div', { class: 'el-card__header' }, props.header) : null,
      h('div', { class: 'el-card__body' }, slots.default?.()),
    ])
  },
})

const ElTag = defineComponent({
  name: 'ElTag',
  props: { type: { type: String, default: '' }, closable: { type: Boolean, default: false } },
  emits: ['close'],
  setup(props, { slots, emit }) {
    return () => h('span', {
      class: ['el-tag', props.type ? `el-tag--${props.type}` : ''],
    }, [
      slots.default?.(),
      props.closable ? h('i', { class: 'el-tag__close', onClick: () => emit('close') }) : null,
    ])
  },
})

const ElFormItem = defineComponent({
  name: 'ElFormItem',
  props: { label: { type: String, default: '' }, prop: { type: String, default: '' } },
  setup(props, { slots }) {
    return () => h('div', { class: 'el-form-item' }, [
      h('label', { class: 'el-form-item__label' }, props.label),
      h('div', { class: 'el-form-item__content' }, slots.default?.()),
    ])
  },
})

const ElSelect = defineComponent({
  name: 'ElSelect',
  props: { modelValue: { type: [String, Number, Array], default: '' }, placeholder: { type: String, default: '请选择' } },
  emits: ['update:modelValue'],
  setup(props, { emit, slots }) {
    return () => h('div', { class: 'el-select' }, [
      h('select', {
        value: props.modelValue,
        onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLSelectElement).value),
      }, slots.default?.()),
    ])
  },
})

const Components = { ElButton, ElInput, ElCard, ElTag, ElFormItem, ElSelect }

// ============================================================================
// 基准测试工具
// ============================================================================

interface BenchmarkEntry {
  category: string
  scenario: string
  scale: string
  metric: string
  value: number
  unit: string
}

const allResults: BenchmarkEntry[] = []

function record(category: string, scenario: string, scale: string, metric: string, value: number, unit: string) {
  allResults.push({ category, scenario, scale, metric, value, unit })
}

/** 多次执行取中位数，消除 JIT 和 GC 偶发抖动 */
async function measureMedian(fn: () => Promise<void>, warmup = 3, runs = 7): Promise<number> {
  for (let i = 0; i < warmup; i++) await fn()
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]
}

function syncMeasureMedian(fn: () => void, warmup = 50, runs = 101): number {
  for (let i = 0; i < warmup; i++) fn()
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    fn()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]
}

// ============================================================================
// Schema 工厂：模拟真实业务场景
// ============================================================================

/** 生成 N 个静态卡片（模拟 Dashboard 面板） */
function makeDashboardSchema(cardCount: number): Schema {
  return {
    type: 'div',
    props: { class: 'dashboard' },
    children: Array.from({ length: cardCount }, (_, i) => ({
      type: 'ElCard',
      props: { header: `Panel ${i}`, shadow: 'hover' },
      children: [
        { type: 'div', props: { class: 'stat-number' }, children: `${(i + 1) * 1234}` },
        { type: 'div', props: { class: 'stat-label' }, children: `Metric ${i}` },
        { type: 'ElTag', props: { type: i % 2 === 0 ? 'success' : 'warning' }, children: i % 2 === 0 ? '上升' : '下降' },
      ],
    })),
  }
}

/** 生成包含表达式绑定的动态表单（N 个字段） */
function makeDynamicFormSchema(fieldCount: number): Schema {
  return {
    type: 'div',
    props: { class: 'form-container' },
    children: Array.from({ length: fieldCount }, (_, i) => ({
      type: 'ElFormItem',
      props: { label: `{{ labels[${i}] }}`, prop: `field${i}` },
      children: [
        i % 3 === 0
          ? { type: 'ElSelect', model: `form.field${i}`, props: { placeholder: `请选择 {{ labels[${i}] }}` } }
          : { type: 'ElInput', model: `form.field${i}`, props: { placeholder: `请输入 {{ labels[${i}] }}` } },
      ],
    })),
  }
}

function makeDynamicFormState(fieldCount: number) {
  const form: Record<string, string> = {}
  const labels: string[] = []
  for (let i = 0; i < fieldCount; i++) {
    form[`field${i}`] = `value${i}`
    labels.push(`Field ${i}`)
  }
  return { form, labels }
}

/** 生成可循环列表（模拟商品列表 / 数据表格） */
function makeProductListSchema(): Schema {
  return {
    type: 'div',
    props: { class: 'product-list' },
    children: [{
      type: 'div',
      loop: { items: '{{ products }}', itemKey: 'item' },
      props: { class: 'product-card', key: '{{ item.id }}' },
      children: [
        { type: 'div', props: { class: 'product-name' }, children: '{{ item.name }}' },
        { type: 'div', props: { class: 'product-price' }, children: '¥{{ item.price }}' },
        { type: 'ElTag', props: { type: '{{ item.inStock ? "success" : "danger" }}' }, children: '{{ item.inStock ? "有货" : "缺货" }}' },
        {
          type: 'div',
          props: { class: 'product-actions' },
          children: [
            { type: 'ElButton', props: { type: 'primary', size: 'small' }, children: '加入购物车' },
            { type: 'ElButton', props: { size: 'small' }, children: '收藏' },
          ],
        },
      ],
    }],
  }
}

function makeProductData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Product ${i}`,
    price: (Math.random() * 1000).toFixed(2),
    inStock: i % 3 !== 0,
    category: `cat-${i % 10}`,
  }))
}

/** 生成多层嵌套结构（模拟组织架构 / 文件树） */
function makeNestedTreeSchema(depth: number, breadth: number): Schema {
  function buildLevel(level: number): Schema {
    if (level >= depth) {
      return {
        type: 'div',
        props: { class: 'leaf' },
        children: '{{ leafLabel }}',
      }
    }
    return {
      type: 'div',
      props: { class: `level-${level}` },
      children: Array.from({ length: breadth }, () => buildLevel(level + 1)),
    }
  }
  return buildLevel(0)
}

/** 生成复杂仪表盘（混合：静态面板 + 动态表格 + 嵌套组件） */
function makeComplexDashboardSchema(panelCount: number, tableRows: number): Schema {
  const panels = Array.from({ length: panelCount }, (_, i) => ({
    type: 'ElCard',
    props: { header: `{{ panelTitles[${i}] }}`, shadow: 'hover' },
    children: [
      { type: 'div', props: { class: 'metric' }, children: '{{ metrics[' + i + '] }}' },
      { type: 'ElTag', props: { type: '{{ metrics[' + i + '] > 50 ? "success" : "warning" }}' }, children: '{{ metrics[' + i + '] > 50 ? "Good" : "Low" }}' },
    ],
  }))
  const table: Schema = {
    type: 'div',
    props: { class: 'data-table' },
    children: [{
      type: 'div',
      loop: { items: '{{ tableData }}', itemKey: 'row' },
      props: { class: 'table-row', key: '{{ row.id }}' },
      children: [
        { type: 'div', props: { class: 'cell' }, children: '{{ row.name }}' },
        { type: 'div', props: { class: 'cell' }, children: '{{ row.value }}' },
        { type: 'ElButton', props: { size: 'small', type: '{{ row.active ? "primary" : "default" }}' }, children: '{{ row.active ? "Active" : "Inactive" }}' },
      ],
    }],
  }
  return {
    type: 'div',
    props: { class: 'complex-dashboard' },
    children: [...panels, table],
  }
}

// ============================================================================
// 测试场景
// ============================================================================

describe('Vario Vue 综合性能基准', () => {

  // ─── A. 初始渲染：逐步提升规模 ──────────────────────────────────────────

  describe('A. 初始渲染 — 逐步提升规模', () => {

    const staticScales = [10, 50, 100, 500, 1000]

    for (const n of staticScales) {
      it(`A1. Dashboard 静态面板 ×${n}`, async () => {
        const schema = makeDashboardSchema(n)
        const dur = await measureMedian(async () => {
          const { vnode } = useVario(schema, { components: Components })
          await nextTick()
          expect(vnode.value).toBeDefined()
        })
        record('A-初始渲染', '静态面板(Dashboard)', `${n}`, 'median', dur, 'ms')
      })
    }

    const formScales = [10, 50, 100, 200]

    for (const n of formScales) {
      it(`A2. 动态表单(含表达式+model) ×${n} 字段`, async () => {
        const schema = makeDynamicFormSchema(n)
        const state = makeDynamicFormState(n)
        const dur = await measureMedian(async () => {
          const { vnode } = useVario(schema, { state, components: Components })
          await nextTick()
          expect(vnode.value).toBeDefined()
        })
        record('A-初始渲染', '动态表单(表达式+model)', `${n}字段`, 'median', dur, 'ms')
      })
    }

    const loopScales = [50, 200, 500, 1000, 2000]

    for (const n of loopScales) {
      it(`A3. 商品列表 loop ×${n}`, async () => {
        const schema = makeProductListSchema()
        const products = makeProductData(n)
        const dur = await measureMedian(async () => {
          const { vnode } = useVario(schema, { state: { products }, components: Components })
          await nextTick()
          expect(vnode.value).toBeDefined()
        })
        record('A-初始渲染', '商品列表(loop)', `${n}项`, 'median', dur, 'ms')
      })
    }

    const treeCases = [
      { depth: 3, breadth: 3 },   // 39 nodes
      { depth: 4, breadth: 3 },   // 120 nodes
      { depth: 5, breadth: 3 },   // 363 nodes
      { depth: 4, breadth: 5 },   // 780 nodes
      { depth: 5, breadth: 4 },   // 1364 nodes
    ]

    for (const { depth, breadth } of treeCases) {
      const totalNodes = (Math.pow(breadth, depth + 1) - 1) / (breadth - 1)
      it(`A4. 嵌套树 depth=${depth} breadth=${breadth} (~${totalNodes}节点)`, async () => {
        const schema = makeNestedTreeSchema(depth, breadth)
        const dur = await measureMedian(async () => {
          const { vnode } = useVario(schema, { state: { leafLabel: 'leaf' }, components: Components })
          await nextTick()
          expect(vnode.value).toBeDefined()
        })
        record('A-初始渲染', '嵌套树', `d${depth}b${breadth}(~${totalNodes})`, 'median', dur, 'ms')
      })
    }

    const complexCases = [
      { panels: 5, rows: 20 },
      { panels: 10, rows: 100 },
      { panels: 20, rows: 500 },
    ]

    for (const { panels, rows } of complexCases) {
      it(`A5. 复杂仪表盘 ${panels}面板+${rows}行表格`, async () => {
        const schema = makeComplexDashboardSchema(panels, rows)
        const panelTitles = Array.from({ length: panels }, (_, i) => `Panel ${i}`)
        const metrics = Array.from({ length: panels }, (_, i) => 30 + i * 5)
        const tableData = Array.from({ length: rows }, (_, i) => ({ id: i, name: `Row${i}`, value: i * 10, active: i % 2 === 0 }))
        const dur = await measureMedian(async () => {
          const { vnode } = useVario(schema, {
            state: { panelTitles, metrics, tableData },
            components: Components,
          })
          await nextTick()
          expect(vnode.value).toBeDefined()
        })
        record('A-初始渲染', '复杂仪表盘', `${panels}p+${rows}r`, 'median', dur, 'ms')
      })
    }
  })

  // ─── B. 响应式更新 ───────────────────────────────────────────────────────

  describe('B. 响应式更新 — 状态变化 → 重渲染', () => {

    it('B1. 单字段更新 ×100 (100 字段表单)', async () => {
      const fieldCount = 100
      const schema = makeDynamicFormSchema(fieldCount)
      const state = makeDynamicFormState(fieldCount)
      const { vnode, state: reactiveState } = useVario(schema, { state, components: Components })
      await nextTick()
      expect(vnode.value).toBeDefined()

      const dur = await measureMedian(async () => {
        for (let i = 0; i < 100; i++) {
          ;(reactiveState as any).form[`field${i % fieldCount}`] = `updated-${i}-${Date.now()}`
        }
        await nextTick()
      })
      record('B-响应式更新', '单字段更新×100', '100字段表单', 'median', dur, 'ms')
    })

    it('B2. 单字段更新 ×1000 (高频连续)', async () => {
      const schema: Schema = {
        type: 'div',
        children: [
          { type: 'div', children: '{{ counter }}' },
          { type: 'div', children: '{{ counter * 2 }}' },
          { type: 'div', children: '{{ message }}' },
        ],
      }
      const { vnode, state } = useVario(schema, {
        state: { counter: 0, message: 'hello' },
      })
      await nextTick()

      const dur = await measureMedian(async () => {
        for (let i = 0; i < 1000; i++) {
          ;(state as any).counter = i
        }
        await nextTick()
      })
      record('B-响应式更新', '高频单字段×1000', '简单schema', 'median', dur, 'ms')
    })

    it('B3. 批量多字段更新 (50 字段同时)', async () => {
      const fieldCount = 50
      const schema = makeDynamicFormSchema(fieldCount)
      const initState = makeDynamicFormState(fieldCount)
      const { vnode, state } = useVario(schema, { state: initState, components: Components })
      await nextTick()

      const dur = await measureMedian(async () => {
        for (let f = 0; f < fieldCount; f++) {
          ;(state as any).form[`field${f}`] = `batch-${f}-${Date.now()}`
        }
        await nextTick()
      })
      record('B-响应式更新', '批量50字段同时更新', '50字段表单', 'median', dur, 'ms')
    })

    const updateCounts = [100, 500, 1000]
    for (const updates of updateCounts) {
      it(`B4. Dashboard metrics 更新 ×${updates} (20 面板)`, async () => {
        const panels = 20
        const schema = makeComplexDashboardSchema(panels, 50)
        const panelTitles = Array.from({ length: panels }, (_, i) => `Panel ${i}`)
        const metrics = Array.from({ length: panels }, (_, i) => 30 + i * 5)
        const tableData = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Row${i}`, value: i * 10, active: i % 2 === 0 }))
        const { vnode, state } = useVario(schema, {
          state: { panelTitles, metrics, tableData },
          components: Components,
        })
        await nextTick()

        const dur = await measureMedian(async () => {
          for (let u = 0; u < updates; u++) {
            const idx = u % panels
            ;(state as any).metrics[idx] = 30 + u
          }
          await nextTick()
        })
        record('B-响应式更新', `Dashboard metrics ×${updates}`, '20面板+50行', 'median', dur, 'ms')
      })
    }
  })

  // ─── C. Loop 中单项更新 ──────────────────────────────────────────────────

  describe('C. Loop 单项更新 — 列表中精确修改某项', () => {

    const listSizes = [100, 500, 1000]

    for (const size of listSizes) {
      it(`C1. 修改单项 name (列表 ${size} 项)`, async () => {
        const schema = makeProductListSchema()
        const products = makeProductData(size)
        const { vnode, state } = useVario(schema, { state: { products }, components: Components })
        await nextTick()

        const dur = await measureMedian(async () => {
          const idx = Math.floor(size / 2)
          ;(state as any).products[idx].name = `Updated-${Date.now()}`
          await nextTick()
        })
        record('C-Loop单项更新', '修改单项name', `${size}项列表`, 'median', dur, 'ms')
      })

      it(`C2. 修改10项 (列表 ${size} 项)`, async () => {
        const schema = makeProductListSchema()
        const products = makeProductData(size)
        const { vnode, state } = useVario(schema, { state: { products }, components: Components })
        await nextTick()

        const dur = await measureMedian(async () => {
          for (let j = 0; j < 10; j++) {
            const idx = (size / 10) * j | 0
            ;(state as any).products[idx].name = `Batch-${j}-${Date.now()}`
            ;(state as any).products[idx].price = (Math.random() * 1000).toFixed(2)
          }
          await nextTick()
        })
        record('C-Loop单项更新', '修改10项', `${size}项列表`, 'median', dur, 'ms')
      })

      it(`C3. 追加1项到末尾 (列表 ${size} 项)`, async () => {
        const schema = makeProductListSchema()
        const products = makeProductData(size)
        const { vnode, state } = useVario(schema, { state: { products }, components: Components })
        await nextTick()

        let counter = 0
        const dur = await measureMedian(async () => {
          ;(state as any).products.push({
            id: size + counter++,
            name: `New Product ${counter}`,
            price: '99.99',
            inStock: true,
            category: 'new',
          })
          await nextTick()
        })
        record('C-Loop单项更新', '追加1项', `${size}项列表`, 'median', dur, 'ms')
      })
    }
  })

  // ─── D. 多层嵌套子树局部更新 ─────────────────────────────────────────────

  describe('D. 多层嵌套 — 子树局部更新', () => {

    it('D1. 只更新叶子节点 (5层×3分支, ~363 节点)', async () => {
      const schema = makeNestedTreeSchema(5, 3)
      const { vnode, state } = useVario(schema, { state: { leafLabel: 'initial' }, components: Components })
      await nextTick()

      const dur = await measureMedian(async () => {
        ;(state as any).leafLabel = `leaf-${Date.now()}`
        await nextTick()
      })
      record('D-嵌套子树更新', '叶子更新', '5层3分支(~363)', 'median', dur, 'ms')
    })

    it('D2. 只更新叶子节点 (4层×5分支, ~780 节点)', async () => {
      const schema = makeNestedTreeSchema(4, 5)
      const { vnode, state } = useVario(schema, { state: { leafLabel: 'initial' }, components: Components })
      await nextTick()

      const dur = await measureMedian(async () => {
        ;(state as any).leafLabel = `leaf-${Date.now()}`
        await nextTick()
      })
      record('D-嵌套子树更新', '叶子更新', '4层5分支(~780)', 'median', dur, 'ms')
    })

    it('D3. 复杂仪表盘 — 只改表格部分 (20 面板不受影响)', async () => {
      const panels = 20
      const rows = 200
      const schema = makeComplexDashboardSchema(panels, rows)
      const panelTitles = Array.from({ length: panels }, (_, i) => `Panel ${i}`)
      const metrics = Array.from({ length: panels }, (_, i) => 30 + i * 5)
      const tableData = Array.from({ length: rows }, (_, i) => ({ id: i, name: `Row${i}`, value: i * 10, active: i % 2 === 0 }))
      const { vnode, state } = useVario(schema, {
        state: { panelTitles, metrics, tableData },
        components: Components,
      })
      await nextTick()

      const dur = await measureMedian(async () => {
        ;(state as any).tableData[0].name = `Updated-${Date.now()}`
        await nextTick()
      })
      record('D-嵌套子树更新', '仪表盘仅改表格首行', '20面板+200行', 'median', dur, 'ms')
    })

    it('D4. 复杂仪表盘 — 只改 metrics (表格不受影响)', async () => {
      const panels = 20
      const rows = 200
      const schema = makeComplexDashboardSchema(panels, rows)
      const panelTitles = Array.from({ length: panels }, (_, i) => `Panel ${i}`)
      const metrics = Array.from({ length: panels }, (_, i) => 30 + i * 5)
      const tableData = Array.from({ length: rows }, (_, i) => ({ id: i, name: `Row${i}`, value: i * 10, active: i % 2 === 0 }))
      const { vnode, state } = useVario(schema, {
        state: { panelTitles, metrics, tableData },
        components: Components,
      })
      await nextTick()

      const dur = await measureMedian(async () => {
        ;(state as any).metrics[0] = Date.now() % 100
        await nextTick()
      })
      record('D-嵌套子树更新', '仪表盘仅改metrics', '20面板+200行', 'median', dur, 'ms')
    })
  })

  // ─── E. 端到端极限压力 ───────────────────────────────────────────────────

  describe('E. 极限场景', () => {

    it('E1. 超大表单 500字段 初始渲染', async () => {
      const schema = makeDynamicFormSchema(500)
      const state = makeDynamicFormState(500)
      const dur = await measureMedian(async () => {
        const { vnode } = useVario(schema, { state, components: Components })
        await nextTick()
        expect(vnode.value).toBeDefined()
      }, 2, 5)
      record('E-极限场景', '超大表单初始渲染', '500字段', 'median', dur, 'ms')
    })

    it('E2. 超长列表 5000 项初始渲染', async () => {
      const schema = makeProductListSchema()
      const products = makeProductData(5000)
      const dur = await measureMedian(async () => {
        const { vnode } = useVario(schema, { state: { products }, components: Components })
        await nextTick()
        expect(vnode.value).toBeDefined()
      }, 2, 5)
      record('E-极限场景', '超长列表初始渲染', '5000项', 'median', dur, 'ms')
    })

    it('E3. 深度嵌套 8层×2分支 (511 节点) 初始渲染', async () => {
      const schema = makeNestedTreeSchema(8, 2)
      const dur = await measureMedian(async () => {
        const { vnode } = useVario(schema, { state: { leafLabel: 'leaf' }, components: Components })
        await nextTick()
        expect(vnode.value).toBeDefined()
      })
      record('E-极限场景', '深嵌套初始渲染', '8层2分支(511)', 'median', dur, 'ms')
    })
  })

  // ─── 汇总报告 ────────────────────────────────────────────────────────────

  afterAll(() => {
    console.log('\n')
    console.log('╔═══════════════════════════════════════════════════════════════════════════════════════╗')
    console.log('║                    Vario Vue 综合性能基准报告                                        ║')
    console.log('╠═══════════════════════════════════════════════════════════════════════════════════════╣')

    let currentCategory = ''
    for (const r of allResults) {
      if (r.category !== currentCategory) {
        currentCategory = r.category
        console.log('╠───────────────────────────────────────────────────────────────────────────────────────╣')
        console.log(`║ [${currentCategory}]`)
        console.log('╠───────────────────────────────────────────────────────────────────────────────────────╣')
      }
      const scenario = `${r.scenario}`.padEnd(30)
      const scale = `${r.scale}`.padEnd(22)
      const value = `${r.value.toFixed(3)}${r.unit}`.padStart(14)
      console.log(`║  ${scenario} ${scale} ${value}  ║`)
    }

    console.log('╚═══════════════════════════════════════════════════════════════════════════════════════╝')

    // 输出 JSON 格式方便后续对比
    console.log('\n===JSON_START===')
    console.log(JSON.stringify(allResults, null, 2))
    console.log('===JSON_END===')
  })
})
