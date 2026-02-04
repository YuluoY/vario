/**
 * Vario 渲染优化基准测试
 *
 * 对比以下方案的性能：
 * 1. 基线：无优化（usePathMemo=false, loopItemAsComponent=false）
 * 2. path-memo：仅启用 path-memo 缓存
 * 3. 列表项组件化：仅启用 loopItemAsComponent
 * 4. 组合优化：path-memo + 列表项组件化
 *
 * 测试场景：
 * - 大量节点渲染
 * - 大量循环渲染
 * - 单项更新
 * - 频繁状态更新
 * - 嵌套循环
 * - Element Plus 组件渲染
 * - Element Plus 表格/表单场景
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick, reactive, h, defineComponent } from 'vue'
import { useVario } from '../src/composable.js'
import type { Schema } from '@variojs/schema'

// ============================================================================
// 模拟 Element Plus 组件（用于测试环境）
// ============================================================================

/** 模拟 ElButton */
const ElButton = defineComponent({
  name: 'ElButton',
  props: {
    type: { type: String, default: 'default' },
    size: { type: String, default: 'default' },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    plain: { type: Boolean, default: false },
    round: { type: Boolean, default: false },
    circle: { type: Boolean, default: false }
  },
  setup(props, { slots }) {
    return () => h('button', {
      class: ['el-button', `el-button--${props.type}`, `el-button--${props.size}`],
      disabled: props.disabled || props.loading
    }, slots.default?.())
  }
})

/** 模拟 ElInput */
const ElInput = defineComponent({
  name: 'ElInput',
  props: {
    modelValue: { type: [String, Number], default: '' },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    clearable: { type: Boolean, default: false },
    size: { type: String, default: 'default' }
  },
  emits: ['update:modelValue', 'input', 'change', 'blur', 'focus'],
  setup(props, { emit }) {
    return () => h('div', { class: 'el-input' }, [
      h('input', {
        class: 'el-input__inner',
        type: props.type,
        value: props.modelValue,
        placeholder: props.placeholder,
        disabled: props.disabled,
        onInput: (e: Event) => {
          const val = (e.target as HTMLInputElement).value
          emit('update:modelValue', val)
          emit('input', val)
        }
      })
    ])
  }
})

/** 模拟 ElSelect */
const ElSelect = defineComponent({
  name: 'ElSelect',
  props: {
    modelValue: { type: [String, Number, Array], default: '' },
    placeholder: { type: String, default: '请选择' },
    disabled: { type: Boolean, default: false },
    multiple: { type: Boolean, default: false },
    clearable: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    return () => h('div', { class: 'el-select' }, [
      h('select', {
        value: props.modelValue,
        disabled: props.disabled,
        onChange: (e: Event) => {
          const val = (e.target as HTMLSelectElement).value
          emit('update:modelValue', val)
          emit('change', val)
        }
      }, slots.default?.())
    ])
  }
})

/** 模拟 ElOption */
const ElOption = defineComponent({
  name: 'ElOption',
  props: {
    value: { type: [String, Number], required: true },
    label: { type: String, default: '' },
    disabled: { type: Boolean, default: false }
  },
  setup(props) {
    return () => h('option', { value: props.value, disabled: props.disabled }, props.label)
  }
})

/** 模拟 ElTable */
const ElTable = defineComponent({
  name: 'ElTable',
  props: {
    data: { type: Array, default: () => [] },
    border: { type: Boolean, default: false },
    stripe: { type: Boolean, default: false },
    height: { type: [String, Number], default: undefined }
  },
  setup(props, { slots }) {
    return () => h('div', { class: 'el-table' }, [
      h('table', {}, [
        h('tbody', {}, 
          (props.data as any[]).map((row, index) => 
            h('tr', { key: index }, slots.default?.({ row, $index: index }))
          )
        )
      ])
    ])
  }
})

/** 模拟 ElTableColumn */
const ElTableColumn = defineComponent({
  name: 'ElTableColumn',
  props: {
    prop: { type: String, default: '' },
    label: { type: String, default: '' },
    width: { type: [String, Number], default: undefined },
    fixed: { type: [Boolean, String], default: false }
  },
  setup(props, { slots }) {
    return () => h('td', { class: 'el-table__cell' }, slots.default?.() || props.label)
  }
})

/** 模拟 ElForm */
const ElForm = defineComponent({
  name: 'ElForm',
  props: {
    model: { type: Object, default: () => ({}) },
    rules: { type: Object, default: () => ({}) },
    labelWidth: { type: String, default: '' },
    labelPosition: { type: String, default: 'right' }
  },
  setup(props, { slots }) {
    return () => h('form', { class: 'el-form' }, slots.default?.())
  }
})

/** 模拟 ElFormItem */
const ElFormItem = defineComponent({
  name: 'ElFormItem',
  props: {
    label: { type: String, default: '' },
    prop: { type: String, default: '' },
    required: { type: Boolean, default: false }
  },
  setup(props, { slots }) {
    return () => h('div', { class: 'el-form-item' }, [
      h('label', { class: 'el-form-item__label' }, props.label),
      h('div', { class: 'el-form-item__content' }, slots.default?.())
    ])
  }
})

/** 模拟 ElTag */
const ElTag = defineComponent({
  name: 'ElTag',
  props: {
    type: { type: String, default: '' },
    closable: { type: Boolean, default: false },
    size: { type: String, default: 'default' }
  },
  emits: ['close'],
  setup(props, { slots, emit }) {
    return () => h('span', { 
      class: ['el-tag', props.type ? `el-tag--${props.type}` : '']
    }, [
      slots.default?.(),
      props.closable ? h('i', { 
        class: 'el-tag__close',
        onClick: () => emit('close')
      }) : null
    ])
  }
})

/** Element Plus 组件映射 */
const ElementPlusComponents = {
  ElButton,
  ElInput,
  ElSelect,
  ElOption,
  ElTable,
  ElTableColumn,
  ElForm,
  ElFormItem,
  ElTag
}

interface BenchmarkResult {
  name: string
  duration: number
  ops: number // operations per second
}

const results: BenchmarkResult[] = []

function recordResult(name: string, duration: number, iterations: number = 1) {
  const ops = iterations / (duration / 1000)
  results.push({ name, duration, ops })
  console.log(`  ${name}: ${duration.toFixed(2)}ms (${ops.toFixed(0)} ops/s)`)
}

describe('Vario 渲染优化基准测试', () => {
  describe('1. 大量节点渲染基准', () => {
    const NODE_COUNT = 1000

    it('基线：无优化', async () => {
      const children: Schema[] = Array.from({ length: NODE_COUNT }, (_, i) => ({
        type: 'div',
        props: { id: `node-${i}`, class: 'item' },
        children: `Node ${i}`
      }))

      const schema: Schema = { type: 'div', children }

      const start = performance.now()
      const { vnode } = useVario(schema, {
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`${NODE_COUNT}节点渲染-基线`, duration)
    })

    it('path-memo 优化', async () => {
      const children: Schema[] = Array.from({ length: NODE_COUNT }, (_, i) => ({
        type: 'div',
        props: { id: `node-${i}`, class: 'item' },
        children: `Node ${i}`
      }))

      const schema: Schema = { type: 'div', children }

      const start = performance.now()
      const { vnode } = useVario(schema, {
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`${NODE_COUNT}节点渲染-pathMemo`, duration)
    })
  })

  describe('2. 大量循环渲染基准', () => {
    const LOOP_COUNT = 500

    it('基线：无优化', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          props: { class: 'item' },
          children: '{{ item.name }}'
        }]
      }

      const items = Array.from({ length: LOOP_COUNT }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { items },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`${LOOP_COUNT}循环渲染-基线`, duration)
    })

    it('path-memo 优化', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          props: { class: 'item' },
          children: '{{ item.name }}'
        }]
      }

      const items = Array.from({ length: LOOP_COUNT }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { items },
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`${LOOP_COUNT}循环渲染-pathMemo`, duration)
    })

    it('列表项组件化', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          props: { class: 'item' },
          children: '{{ item.name }}'
        }]
      }

      const items = Array.from({ length: LOOP_COUNT }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { items },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: true }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`${LOOP_COUNT}循环渲染-loopItemAsComponent`, duration)
    })

    it('组合优化：path-memo + 列表项组件化', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          props: { class: 'item' },
          children: '{{ item.name }}'
        }]
      }

      const items = Array.from({ length: LOOP_COUNT }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { items },
        rendererOptions: { usePathMemo: true, loopItemAsComponent: true }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`${LOOP_COUNT}循环渲染-组合优化`, duration)
    })
  })

  describe('3. 单项更新基准', () => {
    const LOOP_COUNT = 200
    const UPDATE_COUNT = 50

    it('基线：无优化', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          children: '{{ item.name }}'
        }]
      }

      const items = reactive(
        Array.from({ length: LOOP_COUNT }, (_, i) => ({ id: i, name: `Item ${i}` }))
      )

      const { vnode, state } = useVario(schema, {
        state: { items },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < UPDATE_COUNT; i++) {
        state.items[i % LOOP_COUNT].name = `Updated ${i}`
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`单项更新x${UPDATE_COUNT}-基线`, duration, UPDATE_COUNT)
    })

    it('path-memo 优化', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          children: '{{ item.name }}'
        }]
      }

      const items = reactive(
        Array.from({ length: LOOP_COUNT }, (_, i) => ({ id: i, name: `Item ${i}` }))
      )

      const { vnode, state } = useVario(schema, {
        state: { items },
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < UPDATE_COUNT; i++) {
        state.items[i % LOOP_COUNT].name = `Updated ${i}`
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`单项更新x${UPDATE_COUNT}-pathMemo`, duration, UPDATE_COUNT)
    })

    it('列表项组件化', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          children: '{{ item.name }}'
        }]
      }

      const items = reactive(
        Array.from({ length: LOOP_COUNT }, (_, i) => ({ id: i, name: `Item ${i}` }))
      )

      const { vnode, state } = useVario(schema, {
        state: { items },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: true }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < UPDATE_COUNT; i++) {
        state.items[i % LOOP_COUNT].name = `Updated ${i}`
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`单项更新x${UPDATE_COUNT}-loopItemAsComponent`, duration, UPDATE_COUNT)
    })

    it('组合优化：path-memo + 列表项组件化', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          children: '{{ item.name }}'
        }]
      }

      const items = reactive(
        Array.from({ length: LOOP_COUNT }, (_, i) => ({ id: i, name: `Item ${i}` }))
      )

      const { vnode, state } = useVario(schema, {
        state: { items },
        rendererOptions: { usePathMemo: true, loopItemAsComponent: true }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < UPDATE_COUNT; i++) {
        state.items[i % LOOP_COUNT].name = `Updated ${i}`
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`单项更新x${UPDATE_COUNT}-组合优化`, duration, UPDATE_COUNT)
    })
  })

  describe('4. 频繁状态更新基准', () => {
    const UPDATE_COUNT = 100

    it('基线：无优化', async () => {
      const schema: Schema<{ count: number }> = {
        type: 'div',
        children: [
          { type: 'span', children: '{{ count }}' },
          { type: 'span', children: '{{ count * 2 }}' },
          { type: 'span', children: '{{ count + 100 }}' }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: { count: 0 },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < UPDATE_COUNT; i++) {
        state.count = i
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`频繁更新x${UPDATE_COUNT}-基线`, duration, UPDATE_COUNT)
    })

    it('path-memo 优化', async () => {
      const schema: Schema<{ count: number }> = {
        type: 'div',
        children: [
          { type: 'span', children: '{{ count }}' },
          { type: 'span', children: '{{ count * 2 }}' },
          { type: 'span', children: '{{ count + 100 }}' }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: { count: 0 },
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < UPDATE_COUNT; i++) {
        state.count = i
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`频繁更新x${UPDATE_COUNT}-pathMemo`, duration, UPDATE_COUNT)
    })
  })

  describe('5. 嵌套循环基准', () => {
    const OUTER_COUNT = 20
    const INNER_COUNT = 20

    it('基线：无优化', async () => {
      const schema: Schema<{
        groups: Array<{
          id: number
          name: string
          items: Array<{ id: number; label: string }>
        }>
      }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ groups }}', itemKey: 'group' },
          children: [
            { type: 'h3', children: '{{ group.name }}' },
            {
              type: 'ul',
              children: [{
                type: 'li',
                loop: { items: '{{ group.items }}', itemKey: 'subItem' },
                children: '{{ subItem.label }}'
              }]
            }
          ]
        }]
      }

      const groups = Array.from({ length: OUTER_COUNT }, (_, gi) => ({
        id: gi,
        name: `Group ${gi}`,
        items: Array.from({ length: INNER_COUNT }, (_, ii) => ({
          id: gi * 100 + ii,
          label: `Item ${gi}.${ii}`
        }))
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { groups },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`嵌套循环${OUTER_COUNT}x${INNER_COUNT}-基线`, duration)
    })

    it('path-memo 优化', async () => {
      const schema: Schema<{
        groups: Array<{
          id: number
          name: string
          items: Array<{ id: number; label: string }>
        }>
      }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ groups }}', itemKey: 'group' },
          children: [
            { type: 'h3', children: '{{ group.name }}' },
            {
              type: 'ul',
              children: [{
                type: 'li',
                loop: { items: '{{ group.items }}', itemKey: 'subItem' },
                children: '{{ subItem.label }}'
              }]
            }
          ]
        }]
      }

      const groups = Array.from({ length: OUTER_COUNT }, (_, gi) => ({
        id: gi,
        name: `Group ${gi}`,
        items: Array.from({ length: INNER_COUNT }, (_, ii) => ({
          id: gi * 100 + ii,
          label: `Item ${gi}.${ii}`
        }))
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { groups },
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`嵌套循环${OUTER_COUNT}x${INNER_COUNT}-pathMemo`, duration)
    })

    it('列表项组件化', async () => {
      const schema: Schema<{
        groups: Array<{
          id: number
          name: string
          items: Array<{ id: number; label: string }>
        }>
      }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ groups }}', itemKey: 'group' },
          children: [
            { type: 'h3', children: '{{ group.name }}' },
            {
              type: 'ul',
              children: [{
                type: 'li',
                loop: { items: '{{ group.items }}', itemKey: 'subItem' },
                children: '{{ subItem.label }}'
              }]
            }
          ]
        }]
      }

      const groups = Array.from({ length: OUTER_COUNT }, (_, gi) => ({
        id: gi,
        name: `Group ${gi}`,
        items: Array.from({ length: INNER_COUNT }, (_, ii) => ({
          id: gi * 100 + ii,
          label: `Item ${gi}.${ii}`
        }))
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { groups },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: true }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`嵌套循环${OUTER_COUNT}x${INNER_COUNT}-loopItemAsComponent`, duration)
    })

    it('组合优化：path-memo + 列表项组件化', async () => {
      const schema: Schema<{
        groups: Array<{
          id: number
          name: string
          items: Array<{ id: number; label: string }>
        }>
      }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ groups }}', itemKey: 'group' },
          children: [
            { type: 'h3', children: '{{ group.name }}' },
            {
              type: 'ul',
              children: [{
                type: 'li',
                loop: { items: '{{ group.items }}', itemKey: 'subItem' },
                children: '{{ subItem.label }}'
              }]
            }
          ]
        }]
      }

      const groups = Array.from({ length: OUTER_COUNT }, (_, gi) => ({
        id: gi,
        name: `Group ${gi}`,
        items: Array.from({ length: INNER_COUNT }, (_, ii) => ({
          id: gi * 100 + ii,
          label: `Item ${gi}.${ii}`
        }))
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { groups },
        rendererOptions: { usePathMemo: true, loopItemAsComponent: true }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`嵌套循环${OUTER_COUNT}x${INNER_COUNT}-组合优化`, duration)
    })
  })

  describe('6. 复杂表达式基准', () => {
    const EXPR_COUNT = 100

    it('基线：无优化', async () => {
      const children: Schema[] = Array.from({ length: EXPR_COUNT }, (_, i) => ({
        type: 'div',
        children: `{{ count + ${i} * 2 - ${i % 10} }}`
      }))

      const schema: Schema<{ count: number }> = { type: 'div', children }

      const { vnode, state } = useVario(schema, {
        state: { count: 0 },
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < 20; i++) {
        state.count = i
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`${EXPR_COUNT}表达式更新x20-基线`, duration, 20)
    })

    it('path-memo 优化', async () => {
      const children: Schema[] = Array.from({ length: EXPR_COUNT }, (_, i) => ({
        type: 'div',
        children: `{{ count + ${i} * 2 - ${i % 10} }}`
      }))

      const schema: Schema<{ count: number }> = { type: 'div', children }

      const { vnode, state } = useVario(schema, {
        state: { count: 0 },
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < 20; i++) {
        state.count = i
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`${EXPR_COUNT}表达式更新x20-pathMemo`, duration, 20)
    })
  })

  // ============================================================================
  // Element Plus 组件基准测试
  // ============================================================================

  describe('7. Element Plus 表单渲染基准', () => {
    const FORM_FIELD_COUNT = 50

    it('基线：无优化', async () => {
      const formFields: Schema[] = Array.from({ length: FORM_FIELD_COUNT }, (_, i) => ({
        type: 'ElFormItem',
        props: { label: `字段 ${i}`, prop: `field${i}` },
        children: [{
          type: 'ElInput',
          model: `form.field${i}`,
          props: { placeholder: `请输入字段 ${i}` }
        }]
      }))

      const schema: Schema<{ form: Record<string, string> }> = {
        type: 'ElForm',
        props: { labelWidth: '100px' },
        children: formFields
      }

      const initialForm: Record<string, string> = {}
      for (let i = 0; i < FORM_FIELD_COUNT; i++) {
        initialForm[`field${i}`] = ''
      }

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { form: initialForm },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElForm${FORM_FIELD_COUNT}字段-基线`, duration)
    })

    it('path-memo 优化', async () => {
      const formFields: Schema[] = Array.from({ length: FORM_FIELD_COUNT }, (_, i) => ({
        type: 'ElFormItem',
        props: { label: `字段 ${i}`, prop: `field${i}` },
        children: [{
          type: 'ElInput',
          model: `form.field${i}`,
          props: { placeholder: `请输入字段 ${i}` }
        }]
      }))

      const schema: Schema<{ form: Record<string, string> }> = {
        type: 'ElForm',
        props: { labelWidth: '100px' },
        children: formFields
      }

      const initialForm: Record<string, string> = {}
      for (let i = 0; i < FORM_FIELD_COUNT; i++) {
        initialForm[`field${i}`] = ''
      }

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { form: initialForm },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElForm${FORM_FIELD_COUNT}字段-pathMemo`, duration)
    })
  })

  describe('8. Element Plus 表格渲染基准', () => {
    const TABLE_ROW_COUNT = 200

    it('基线：无优化', async () => {
      const schema: Schema<{ 
        tableData: Array<{ id: number; name: string; status: string; date: string }> 
      }> = {
        type: 'ElTable',
        props: { 
          data: '{{ tableData }}',
          border: true,
          stripe: true
        },
        children: [
          { type: 'ElTableColumn', props: { prop: 'id', label: 'ID', width: '80' } },
          { type: 'ElTableColumn', props: { prop: 'name', label: '名称' } },
          { type: 'ElTableColumn', props: { prop: 'status', label: '状态' } },
          { type: 'ElTableColumn', props: { prop: 'date', label: '日期' } }
        ]
      }

      const tableData = Array.from({ length: TABLE_ROW_COUNT }, (_, i) => ({
        id: i + 1,
        name: `用户 ${i + 1}`,
        status: i % 2 === 0 ? '启用' : '禁用',
        date: '2026-02-02'
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { tableData },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElTable${TABLE_ROW_COUNT}行-基线`, duration)
    })

    it('path-memo 优化', async () => {
      const schema: Schema<{ 
        tableData: Array<{ id: number; name: string; status: string; date: string }> 
      }> = {
        type: 'ElTable',
        props: { 
          data: '{{ tableData }}',
          border: true,
          stripe: true
        },
        children: [
          { type: 'ElTableColumn', props: { prop: 'id', label: 'ID', width: '80' } },
          { type: 'ElTableColumn', props: { prop: 'name', label: '名称' } },
          { type: 'ElTableColumn', props: { prop: 'status', label: '状态' } },
          { type: 'ElTableColumn', props: { prop: 'date', label: '日期' } }
        ]
      }

      const tableData = Array.from({ length: TABLE_ROW_COUNT }, (_, i) => ({
        id: i + 1,
        name: `用户 ${i + 1}`,
        status: i % 2 === 0 ? '启用' : '禁用',
        date: '2026-02-02'
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { tableData },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElTable${TABLE_ROW_COUNT}行-pathMemo`, duration)
    })
  })

  describe('9. Element Plus 循环列表基准', () => {
    const LIST_COUNT = 300

    it('基线：无优化', async () => {
      const schema: Schema<{ 
        items: Array<{ id: number; title: string; tags: string[] }> 
      }> = {
        type: 'div',
        props: { class: 'item-list' },
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item', indexKey: 'idx' },
          props: { class: 'list-item' },
          children: [
            { 
              type: 'ElButton', 
              props: { type: 'primary', size: 'small' },
              children: '{{ item.title }}'
            },
            {
              type: 'span',
              loop: { items: '{{ item.tags }}', itemKey: 'tag' },
              children: [{
                type: 'ElTag',
                props: { type: '{{ idx % 2 === 0 ? "success" : "warning" }}', size: 'small' },
                children: '{{ tag }}'
              }]
            }
          ]
        }]
      }

      const items = Array.from({ length: LIST_COUNT }, (_, i) => ({
        id: i + 1,
        title: `项目 ${i + 1}`,
        tags: [`标签${i % 5}`, `类型${i % 3}`]
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { items },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElButton+Tag循环${LIST_COUNT}项-基线`, duration)
    })

    it('path-memo 优化', async () => {
      const schema: Schema<{ 
        items: Array<{ id: number; title: string; tags: string[] }> 
      }> = {
        type: 'div',
        props: { class: 'item-list' },
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item', indexKey: 'idx' },
          props: { class: 'list-item' },
          children: [
            { 
              type: 'ElButton', 
              props: { type: 'primary', size: 'small' },
              children: '{{ item.title }}'
            },
            {
              type: 'span',
              loop: { items: '{{ item.tags }}', itemKey: 'tag' },
              children: [{
                type: 'ElTag',
                props: { type: '{{ idx % 2 === 0 ? "success" : "warning" }}', size: 'small' },
                children: '{{ tag }}'
              }]
            }
          ]
        }]
      }

      const items = Array.from({ length: LIST_COUNT }, (_, i) => ({
        id: i + 1,
        title: `项目 ${i + 1}`,
        tags: [`标签${i % 5}`, `类型${i % 3}`]
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { items },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElButton+Tag循环${LIST_COUNT}项-pathMemo`, duration)
    })

    it('列表项组件化', async () => {
      const schema: Schema<{ 
        items: Array<{ id: number; title: string; tags: string[] }> 
      }> = {
        type: 'div',
        props: { class: 'item-list' },
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item', indexKey: 'idx' },
          props: { class: 'list-item' },
          children: [
            { 
              type: 'ElButton', 
              props: { type: 'primary', size: 'small' },
              children: '{{ item.title }}'
            },
            {
              type: 'span',
              loop: { items: '{{ item.tags }}', itemKey: 'tag' },
              children: [{
                type: 'ElTag',
                props: { type: '{{ idx % 2 === 0 ? "success" : "warning" }}', size: 'small' },
                children: '{{ tag }}'
              }]
            }
          ]
        }]
      }

      const items = Array.from({ length: LIST_COUNT }, (_, i) => ({
        id: i + 1,
        title: `项目 ${i + 1}`,
        tags: [`标签${i % 5}`, `类型${i % 3}`]
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { items },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: false, loopItemAsComponent: true }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElButton+Tag循环${LIST_COUNT}项-loopItemAsComponent`, duration)
    })

    it('组合优化：path-memo + 列表项组件化', async () => {
      const schema: Schema<{ 
        items: Array<{ id: number; title: string; tags: string[] }> 
      }> = {
        type: 'div',
        props: { class: 'item-list' },
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item', indexKey: 'idx' },
          props: { class: 'list-item' },
          children: [
            { 
              type: 'ElButton', 
              props: { type: 'primary', size: 'small' },
              children: '{{ item.title }}'
            },
            {
              type: 'span',
              loop: { items: '{{ item.tags }}', itemKey: 'tag' },
              children: [{
                type: 'ElTag',
                props: { type: '{{ idx % 2 === 0 ? "success" : "warning" }}', size: 'small' },
                children: '{{ tag }}'
              }]
            }
          ]
        }]
      }

      const items = Array.from({ length: LIST_COUNT }, (_, i) => ({
        id: i + 1,
        title: `项目 ${i + 1}`,
        tags: [`标签${i % 5}`, `类型${i % 3}`]
      }))

      const start = performance.now()
      const { vnode } = useVario(schema, {
        state: { items },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: true, loopItemAsComponent: true }
      })
      await nextTick()
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElButton+Tag循环${LIST_COUNT}项-组合优化`, duration)
    })
  })

  describe('10. Element Plus 单项更新基准', () => {
    const LIST_COUNT = 100
    const UPDATE_COUNT = 30

    it('基线：无优化', async () => {
      const schema: Schema<{ 
        items: Array<{ id: number; name: string; status: boolean }> 
      }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          props: { class: 'item-row' },
          children: [
            { type: 'ElInput', model: 'item.name', props: { size: 'small' } },
            { 
              type: 'ElButton', 
              props: { 
                type: '{{ item.status ? "success" : "danger" }}',
                size: 'small'
              },
              children: '{{ item.status ? "启用" : "禁用" }}'
            }
          ]
        }]
      }

      const items = reactive(
        Array.from({ length: LIST_COUNT }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          status: true
        }))
      )

      const { vnode, state } = useVario(schema, {
        state: { items },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < UPDATE_COUNT; i++) {
        state.items[i % LIST_COUNT].status = !state.items[i % LIST_COUNT].status
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElInput+Button单项更新x${UPDATE_COUNT}-基线`, duration, UPDATE_COUNT)
    })

    it('path-memo 优化', async () => {
      const schema: Schema<{ 
        items: Array<{ id: number; name: string; status: boolean }> 
      }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          props: { class: 'item-row' },
          children: [
            { type: 'ElInput', model: 'item.name', props: { size: 'small' } },
            { 
              type: 'ElButton', 
              props: { 
                type: '{{ item.status ? "success" : "danger" }}',
                size: 'small'
              },
              children: '{{ item.status ? "启用" : "禁用" }}'
            }
          ]
        }]
      }

      const items = reactive(
        Array.from({ length: LIST_COUNT }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          status: true
        }))
      )

      const { vnode, state } = useVario(schema, {
        state: { items },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < UPDATE_COUNT; i++) {
        state.items[i % LIST_COUNT].status = !state.items[i % LIST_COUNT].status
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElInput+Button单项更新x${UPDATE_COUNT}-pathMemo`, duration, UPDATE_COUNT)
    })

    it('列表项组件化', async () => {
      const schema: Schema<{ 
        items: Array<{ id: number; name: string; status: boolean }> 
      }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          props: { class: 'item-row' },
          children: [
            { type: 'ElInput', model: 'item.name', props: { size: 'small' } },
            { 
              type: 'ElButton', 
              props: { 
                type: '{{ item.status ? "success" : "danger" }}',
                size: 'small'
              },
              children: '{{ item.status ? "启用" : "禁用" }}'
            }
          ]
        }]
      }

      const items = reactive(
        Array.from({ length: LIST_COUNT }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          status: true
        }))
      )

      const { vnode, state } = useVario(schema, {
        state: { items },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: false, loopItemAsComponent: true }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < UPDATE_COUNT; i++) {
        state.items[i % LIST_COUNT].status = !state.items[i % LIST_COUNT].status
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElInput+Button单项更新x${UPDATE_COUNT}-loopItemAsComponent`, duration, UPDATE_COUNT)
    })

    it('组合优化：path-memo + 列表项组件化', async () => {
      const schema: Schema<{ 
        items: Array<{ id: number; name: string; status: boolean }> 
      }> = {
        type: 'div',
        children: [{
          type: 'div',
          loop: { items: '{{ items }}', itemKey: 'item' },
          props: { class: 'item-row' },
          children: [
            { type: 'ElInput', model: 'item.name', props: { size: 'small' } },
            { 
              type: 'ElButton', 
              props: { 
                type: '{{ item.status ? "success" : "danger" }}',
                size: 'small'
              },
              children: '{{ item.status ? "启用" : "禁用" }}'
            }
          ]
        }]
      }

      const items = reactive(
        Array.from({ length: LIST_COUNT }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          status: true
        }))
      )

      const { vnode, state } = useVario(schema, {
        state: { items },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: true, loopItemAsComponent: true }
      })
      await nextTick()

      const start = performance.now()
      for (let i = 0; i < UPDATE_COUNT; i++) {
        state.items[i % LIST_COUNT].status = !state.items[i % LIST_COUNT].status
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult(`ElInput+Button单项更新x${UPDATE_COUNT}-组合优化`, duration, UPDATE_COUNT)
    })
  })

  describe('11. Element Plus 复杂表单场景基准', () => {
    it('基线：无优化', async () => {
      const schema: Schema<{ 
        form: {
          username: string
          email: string
          phone: string
          address: string
          gender: string
          tags: string[]
        }
      }> = {
        type: 'ElForm',
        props: { labelWidth: '120px' },
        children: [
          {
            type: 'ElFormItem',
            props: { label: '用户名', prop: 'username', required: true },
            children: [{ type: 'ElInput', model: 'form.username', props: { placeholder: '请输入用户名' } }]
          },
          {
            type: 'ElFormItem',
            props: { label: '邮箱', prop: 'email' },
            children: [{ type: 'ElInput', model: 'form.email', props: { placeholder: '请输入邮箱' } }]
          },
          {
            type: 'ElFormItem',
            props: { label: '电话', prop: 'phone' },
            children: [{ type: 'ElInput', model: 'form.phone', props: { placeholder: '请输入电话' } }]
          },
          {
            type: 'ElFormItem',
            props: { label: '地址', prop: 'address' },
            children: [{ type: 'ElInput', model: 'form.address', props: { placeholder: '请输入地址' } }]
          },
          {
            type: 'ElFormItem',
            props: { label: '性别', prop: 'gender' },
            children: [{
              type: 'ElSelect',
              model: 'form.gender',
              props: { placeholder: '请选择性别' },
              children: [
                { type: 'ElOption', props: { label: '男', value: 'male' } },
                { type: 'ElOption', props: { label: '女', value: 'female' } }
              ]
            }]
          },
          {
            type: 'ElFormItem',
            props: { label: '操作' },
            children: [
              { type: 'ElButton', props: { type: 'primary' }, children: '提交' },
              { type: 'ElButton', children: '重置' }
            ]
          }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: {
          form: {
            username: '',
            email: '',
            phone: '',
            address: '',
            gender: '',
            tags: []
          }
        },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: false, loopItemAsComponent: false }
      })
      await nextTick()

      // 模拟表单填写
      const start = performance.now()
      for (let i = 0; i < 20; i++) {
        state.form.username = `user${i}`
        await nextTick()
        state.form.email = `user${i}@test.com`
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult('ElForm复杂表单填写x20-基线', duration, 40)
    })

    it('path-memo 优化', async () => {
      const schema: Schema<{ 
        form: {
          username: string
          email: string
          phone: string
          address: string
          gender: string
          tags: string[]
        }
      }> = {
        type: 'ElForm',
        props: { labelWidth: '120px' },
        children: [
          {
            type: 'ElFormItem',
            props: { label: '用户名', prop: 'username', required: true },
            children: [{ type: 'ElInput', model: 'form.username', props: { placeholder: '请输入用户名' } }]
          },
          {
            type: 'ElFormItem',
            props: { label: '邮箱', prop: 'email' },
            children: [{ type: 'ElInput', model: 'form.email', props: { placeholder: '请输入邮箱' } }]
          },
          {
            type: 'ElFormItem',
            props: { label: '电话', prop: 'phone' },
            children: [{ type: 'ElInput', model: 'form.phone', props: { placeholder: '请输入电话' } }]
          },
          {
            type: 'ElFormItem',
            props: { label: '地址', prop: 'address' },
            children: [{ type: 'ElInput', model: 'form.address', props: { placeholder: '请输入地址' } }]
          },
          {
            type: 'ElFormItem',
            props: { label: '性别', prop: 'gender' },
            children: [{
              type: 'ElSelect',
              model: 'form.gender',
              props: { placeholder: '请选择性别' },
              children: [
                { type: 'ElOption', props: { label: '男', value: 'male' } },
                { type: 'ElOption', props: { label: '女', value: 'female' } }
              ]
            }]
          },
          {
            type: 'ElFormItem',
            props: { label: '操作' },
            children: [
              { type: 'ElButton', props: { type: 'primary' }, children: '提交' },
              { type: 'ElButton', children: '重置' }
            ]
          }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: {
          form: {
            username: '',
            email: '',
            phone: '',
            address: '',
            gender: '',
            tags: []
          }
        },
        components: ElementPlusComponents,
        rendererOptions: { usePathMemo: true, loopItemAsComponent: false }
      })
      await nextTick()

      // 模拟表单填写
      const start = performance.now()
      for (let i = 0; i < 20; i++) {
        state.form.username = `user${i}`
        await nextTick()
        state.form.email = `user${i}@test.com`
        await nextTick()
      }
      const duration = performance.now() - start

      expect(vnode.value).toBeDefined()
      recordResult('ElForm复杂表单填写x20-pathMemo', duration, 40)
    })
  })

  // 方案 C & D 基准测试
  describe('12. Schema 碎片化（方案 D）基准', () => {
    it('SchemaStore 初始化性能', async () => {
      const { createSchemaStore } = await import('../src/features/schema-store.js')
      
      // 生成大型 schema 树
      const generateTree = (depth: number, breadth: number): Schema => {
        if (depth === 0) {
          return { type: 'span', children: 'leaf' }
        }
        return {
          type: 'div',
          children: Array.from({ length: breadth }, () => generateTree(depth - 1, breadth))
        }
      }
      
      const schema = generateTree(4, 5) // 5^4 = 625 节点
      
      const start = performance.now()
      const store = createSchemaStore()
      store.fromTree(schema as any)
      const duration = performance.now() - start
      
      expect(store.keys().length).toBeGreaterThan(600)
      recordResult('SchemaStore初始化625节点', duration, 1)
    })

    it('SchemaStore patch 性能', async () => {
      const { createSchemaStore } = await import('../src/features/schema-store.js')
      
      const generateTree = (depth: number, breadth: number): Schema => {
        if (depth === 0) {
          return { type: 'span', children: 'leaf' }
        }
        return {
          type: 'div',
          children: Array.from({ length: breadth }, () => generateTree(depth - 1, breadth))
        }
      }
      
      const schema = generateTree(4, 5)
      const store = createSchemaStore()
      store.fromTree(schema as any)
      
      const paths = store.keys()
      
      const start = performance.now()
      for (let i = 0; i < 100; i++) {
        const randomPath = paths[Math.floor(Math.random() * paths.length)]
        store.patch(randomPath, { props: { updated: true } })
      }
      const duration = performance.now() - start
      
      expect(duration).toBeLessThan(50)
      recordResult('SchemaStore-patch100次', duration, 100)
    })

    it('SchemaStore toTree 还原性能', async () => {
      const { createSchemaStore } = await import('../src/features/schema-store.js')
      
      const generateTree = (depth: number, breadth: number): Schema => {
        if (depth === 0) {
          return { type: 'span', children: 'leaf' }
        }
        return {
          type: 'div',
          children: Array.from({ length: breadth }, () => generateTree(depth - 1, breadth))
        }
      }
      
      const schema = generateTree(4, 5)
      const store = createSchemaStore()
      store.fromTree(schema as any)
      
      const start = performance.now()
      for (let i = 0; i < 10; i++) {
        store.toTree()
      }
      const duration = performance.now() - start
      
      recordResult('SchemaStore-toTree10次', duration, 10)
    })
  })

  describe('13. 子树组件化（方案 C）基准', () => {
    it('VarioNode 创建性能', async () => {
      const { createVarioNodeVNode, VarioNode } = await import('../src/features/vario-node.js')
      const { createRuntimeContext } = await import('@variojs/core')
      
      const mockRenderer = {
        resolveComponent: (type: string) => type,
        evaluateExpr: (expr: string) => true,
        buildAttrs: (schema: any) => schema.props || {},
        resolveChildren: () => null
      }
      
      const ctx = createRuntimeContext({})
      const schemas = Array.from({ length: 500 }, (_, i) => ({
        type: 'div',
        props: { id: `node-${i}`, class: 'item' },
        children: `Node ${i}`
      }))
      
      const start = performance.now()
      for (const schema of schemas) {
        createVarioNodeVNode(schema as any, ctx, '', mockRenderer as any)
      }
      const duration = performance.now() - start
      
      recordResult('VarioNode创建500个', duration, 500)
    })

    it('shouldComponentize 判断性能', async () => {
      const { shouldComponentize } = await import('../src/features/vario-node.js')
      
      const schemas = [
        { type: 'div' },
        { type: 'ElButton' },
        { type: 'div', loop: { items: '{{ items }}', itemKey: 'item' } },
        { type: 'span', onMounted: [] }
      ]
      
      const start = performance.now()
      for (let i = 0; i < 10000; i++) {
        for (const schema of schemas) {
          shouldComponentize(schema as any, i % 10, { enabled: true, granularity: 'boundary' })
        }
      }
      const duration = performance.now() - start
      
      recordResult('shouldComponentize判断40000次', duration, 40000)
    })
  })

  describe('14. 组合优化（A+B+C+D）对比', () => {
    it('全量优化 vs 基线：大型 Schema', async () => {
      // 生成 500 节点的 Schema
      const children: Schema[] = Array.from({ length: 500 }, (_, i) => ({
        type: i % 3 === 0 ? 'ElButton' : 'div',
        props: { id: `node-${i}`, class: 'item' },
        children: `Node ${i}`
      }))
      
      const schema: Schema = { type: 'div', children }
      
      // 基线
      const startBaseline = performance.now()
      const baseline = useVario(schema, {
        components: ElementPlusComponents,
        rendererOptions: { 
          usePathMemo: false, 
          loopItemAsComponent: false,
          subtreeComponent: { enabled: false },
          schemaFragment: { enabled: false }
        }
      })
      await nextTick()
      const baselineDuration = performance.now() - startBaseline
      
      // 全量优化
      const startOptimized = performance.now()
      const optimized = useVario(schema, {
        components: ElementPlusComponents,
        rendererOptions: { 
          usePathMemo: true, 
          loopItemAsComponent: true,
          subtreeComponent: { enabled: true, granularity: 'boundary' },
          schemaFragment: { enabled: true }
        }
      })
      await nextTick()
      const optimizedDuration = performance.now() - startOptimized
      
      expect(baseline.vnode.value).toBeDefined()
      expect(optimized.vnode.value).toBeDefined()
      
      recordResult('500节点基线', baselineDuration, 1)
      recordResult('500节点全量优化', optimizedDuration, 1)
    })
  })

  // 输出汇总结果
  describe('基准测试结果汇总', () => {
    it('输出所有基准测试结果', () => {
      console.log('\n========== 基准测试结果汇总 ==========')
      console.log('测试环境: Node.js + Vitest + Vue 3')
      console.log('测试日期:', new Date().toISOString().split('T')[0])
      console.log('')

      const grouped = new Map<string, BenchmarkResult[]>()
      for (const r of results) {
        const category = r.name.split('-')[0]
        if (!grouped.has(category)) grouped.set(category, [])
        grouped.get(category)!.push(r)
      }

      for (const [category, items] of grouped) {
        console.log(`\n【${category}】`)
        const baseline = items.find(i => i.name.includes('基线'))
        for (const item of items) {
          const speedup = baseline && !item.name.includes('基线')
            ? ` (${(baseline.duration / item.duration).toFixed(2)}x)`
            : ''
          console.log(`  ${item.name}: ${item.duration.toFixed(2)}ms${speedup}`)
        }
      }

      console.log('\n==========================================')
      expect(results.length).toBeGreaterThan(0)
    })
  })
})
