/**
 * @vitest-environment happy-dom
 * 用户报告的 5 个 play demo 症状复现（legacy 模式 + 组件 v-model，模拟 ElInput/ElCheckbox）
 */
import { describe, it, expect, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { useVario } from '../../src/index.js'

/** 模拟 ElInput：emit('update:modelValue', string) */
const VInput = defineComponent({
  name: 'VInput',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', {
      value: props.modelValue,
      onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value)
    })
  }
})
/** 模拟 ElCheckbox：emit('update:modelValue', boolean) */
const VCheckbox = defineComponent({
  name: 'VCheckbox',
  props: { modelValue: { type: Boolean, default: false } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', {
      type: 'checkbox',
      checked: props.modelValue,
      onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).checked)
    })
  }
})

/** 模拟 ElDialog：modelValue 控制显隐，footer slot 放按钮 */
const VDialog = defineComponent({
  name: 'VDialog',
  props: { modelValue: { type: Boolean, default: false }, title: { type: String, default: '' } },
  emits: ['update:modelValue'],
  setup(props, { slots }) {
    return () => props.modelValue
      ? h('div', { class: 'v-dialog' }, [h('div', slots.default?.()), h('div', { class: 'v-dialog__footer' }, slots.footer?.())])
      : null
  }
})

function mount(schema: unknown, options: Record<string, unknown>) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  let api!: ReturnType<typeof useVario>
  const app = createApp(defineComponent({
    setup() {
      api = useVario(schema as never, options as never)
      return () => api.vnode.value
    }
  }))
  app.component('VInput', VInput)
  app.component('VCheckbox', VCheckbox)
  app.component('VDialog', VDialog)
  app.mount(host)
  return { host, api: () => api, unmount() { app.unmount(); host.remove() } }
}

describe('症状1：表单填完提交仍灰（isValid 不更新）', () => {
  it('输入文本后 disabled 应解除', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { VueRenderer } = await import('../../src/renderer.js')
    const { invalidateCache } = await import('@variojs/core')
    let renderCalls = 0
    const origRender = VueRenderer.prototype.render
    ;(VueRenderer.prototype as unknown as { render: (...a: unknown[]) => unknown }).render = function (...a: unknown[]) {
      renderCalls++
      return (origRender as (...a: unknown[]) => unknown).apply(this, a)
    }
    const t = mount(
      {
        type: 'div',
        children: [
          { type: 'VInput', model: 'name' },
          { type: 'button', props: { disabled: '{{ !isValid }}' }, children: '提交' }
        ]
      },
      {
        state: { name: '' },
        computed: { isValid: (s: { name: string }) => s.name.trim().length > 0 }
      }
    )
    await nextTick()
    const btn = t.host.querySelector('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    const input = t.host.querySelector('input') as HTMLInputElement
    input.value = '张三'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    await new Promise(r => setTimeout(r, 20))
    console.log('[repro1] name =', JSON.stringify(t.api().ctx.value._get('name')),
      '| isValid =', t.api().ctx.value._get('isValid'),
      '| disabled =', btn.disabled,
      '| renderer.render calls =', renderCalls)
    ;(VueRenderer.prototype as unknown as { render: (...a: unknown[]) => unknown }).render = origRender
    const errs = errSpy.mock.calls.map(c => c.slice(0, 2).join(' ')).join('\n')
    console.log('[repro1] console.error:\n' + (errs || '(none)'))
    expect(btn.disabled).toBe(false)
    errSpy.mockRestore()
    t.unmount()
  })
})

describe('症状5：勾选 todo 后统计不变', () => {
  it('勾选后 completedCount 应更新', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const t = mount(
      {
        type: 'div',
        children: [
          {
            type: 'div',
            loop: { items: '{{ todos }}', itemKey: 'todo' },
            children: [{ type: 'VCheckbox', model: 'todo.completed' }]
          },
          { type: 'span', children: '{{ completedCount || 0 }}' }
        ]
      },
      {
        state: { todos: [{ id: 1, text: 'a', completed: false }, { id: 2, text: 'b', completed: false }] },
        computed: { completedCount: (s: { todos: Array<{ completed: boolean }> }) => s.todos.filter(x => x.completed).length }
      }
    )
    await nextTick()
    expect(t.host.textContent).toContain('0')
    const cb = t.host.querySelector('input[type="checkbox"]') as HTMLInputElement
    cb.click()
    await nextTick()
    await new Promise(r => setTimeout(r, 20))
    console.log('[repro2] todos.0.completed =', t.api().ctx.value._get('todos.0.completed'),
      '| completedCount(ctx) =', t.api().ctx.value._get('completedCount'),
      '| text =', JSON.stringify(t.host.textContent))
    const errs = errSpy.mock.calls.map(c => c.slice(0, 2).join(' ')).join('\n')
    console.log('[repro2] console.error:\n' + (errs || '(none)'))
    expect(t.host.textContent).toContain('1')
    errSpy.mockRestore()
    t.unmount()
  })
})

describe('症状2：购物车结算后物品仍在', () => {
  it('checkout（_set cart + 直接改 showCart）后应回到商品列表', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const logs: string[] = []
    const t = mount(
      {
        type: 'div',
        children: [
          { type: 'div', cond: '{{ !showCart }}', children: [{ type: 'span', class: 'products', children: '商品列表' }] },
          {
            type: 'div', cond: '{{ showCart }}',
            children: [
              { type: 'div', loop: { items: '{{ cart }}', itemKey: 'item' }, children: [{ type: 'span', children: '{{ item.name }}' }] },
              { type: 'button', events: { click: [{ type: 'call', method: 'checkout' }] }, children: '结算' }
            ]
          }
        ]
      },
      {
        state: { products: [], cart: [{ id: 1, name: 'iPhone', price: 10, quantity: 1 }], showCart: true },
        computed: { cartEmpty: (s: { cart: unknown[] }) => s.cart.length === 0 },
        methods: {
          checkout: ({ state, ctx }: { state: Record<string, unknown>; ctx: { _set: (p: string, v: unknown) => void } }) => {
            logs.push('checkout-run')
            ctx._set('cart', [])
            state.showCart = false
          }
        }
      }
    )
    await nextTick()
    expect(t.host.textContent).toContain('iPhone')
    const btn = t.host.querySelector('button') as HTMLButtonElement
    btn.click()
    await nextTick()
    await new Promise(r => setTimeout(r, 20))
    console.log('[repro3] checkout ran =', logs.length > 0,
      '| cart =', JSON.stringify(t.api().ctx.value._get('cart')),
      '| showCart =', t.api().ctx.value._get('showCart'),
      '| text =', JSON.stringify(t.host.textContent))
    expect(logs.length).toBe(1)
    expect(t.host.textContent).toContain('商品列表')
    expect(t.host.textContent).not.toContain('iPhone')
    t.unmount()
  })

  it('checkout 后渲染在 cond 区域外的 computed 徽标（{{ totalItems }}）应立即归零', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { evaluate } = await import('@variojs/core')
    const t = mount(
      {
        type: 'div',
        children: [
          // 徽标渲染在两个 cond 区域之外（真实 demo 中位于标题栏 ElBadge）
          { type: 'span', props: { class: 'badge' }, children: '{{ totalItems }}' },
          {
            type: 'div', cond: '{{ showCart }}',
            children: [{ type: 'button', events: { click: [{ type: 'call', method: 'checkout' }] }, children: '结算 ({{ totalItems }} 件)' }]
          }
        ]
      },
      {
        // 与真实 demo 相同：库存嵌套对象直接突变（不依赖 computed）+ _set + 直接改 showCart
        state: {
          products: [{ id: 1, stock: 10 }, { id: 2, stock: 5 }],
          cart: [{ id: 1, quantity: 1 }, { id: 2, quantity: 1 }],
          showCart: true
        },
        computed: { totalItems: (s: { cart: Array<{ quantity: number }> }) => s.cart.reduce((n, i) => n + i.quantity, 0) },
        methods: {
          checkout: ({ state, ctx }: { state: { cart: Array<{ id: number; quantity: number }>; products: Array<{ id: number; stock: number }> } & Record<string, unknown>; ctx: { _set: (p: string, v: unknown) => void } }) => {
            state.cart.forEach((item) => {
              const product = state.products.find(p => p.id === item.id)
              if (product) product.stock = Math.max(0, product.stock - item.quantity)
            })
            ctx._set('cart', [])
            state.showCart = false
          }
        }
      }
    )
    await nextTick()
    expect(t.host.querySelector('.badge')!.textContent).toBe('2')
    const ctx = t.api().ctx.value as unknown as Parameters<typeof evaluate>[1]
    // 首次渲染已为 '{{ totalItems }}' 建立表达式缓存
    expect(evaluate('{{ totalItems }}', ctx)).toBe(2)
    ;(t.host.querySelector('button') as HTMLButtonElement).click()
    // 同步断言（不等任何微任务）：写 state 的同步代码执行完后，computed 表达式缓存必须已失效。
    // 浏览器实测：渲染微任务可能先于 flushJobs（pre watch）执行——若失效滞后，
    // 本帧渲染命中陈旧缓存（结算徽标冻结在旧值），失效发生在渲染后且无人再渲染。
    const syncValue = evaluate('{{ totalItems }}', ctx)
    console.log('[repro3b] cache value synchronously after checkout =', syncValue)
    expect(syncValue).toBe(0)
    // 徽标必须在本帧读到失效后的 computed，而不是等下次交互
    await nextTick()
    console.log('[repro3b] badge after one tick =', JSON.stringify(t.host.querySelector('.badge')!.textContent))
    expect(t.host.querySelector('.badge')!.textContent).toBe('0')
    t.unmount()
  })
})

describe('症状4：编辑弹窗保存/取消不关闭', () => {
  it('点击保存（call method 直接改 state.editDialogVisible）后弹窗应关闭', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const logs: string[] = []
    const t = mount(
      {
        type: 'div',
        children: [
          {
            type: 'VDialog', model: 'editDialogVisible', props: { title: '编辑' },
            children: [
              { type: 'input', model: 'editingProduct.name' },
              {
                type: 'template', slot: 'footer',
                children: [
                  { type: 'button', events: { click: [{ type: 'call', method: 'cancelEdit' }] }, children: '取消' },
                  { type: 'button', props: { type: 'primary' }, events: { click: [{ type: 'call', method: 'saveEdit' }] }, children: '保存' }
                ]
              }
            ]
          }
        ]
      },
      {
        state: { editDialogVisible: true, editingProduct: { id: 1, name: 'p1' } },
        methods: {
          saveEdit: ({ state }: { state: Record<string, unknown> }) => { logs.push('save-run'); state.editDialogVisible = false },
          cancelEdit: ({ state }: { state: Record<string, unknown> }) => { logs.push('cancel-run'); state.editDialogVisible = false }
        }
      }
    )
    await nextTick()
    const dlg = t.host.querySelector('.v-dialog') as HTMLElement
    expect(dlg).toBeTruthy()
    const saveBtn = Array.from(t.host.querySelectorAll('button')).find(b => b.textContent === '保存') as HTMLButtonElement
    saveBtn.click()
    await nextTick()
    await new Promise(r => setTimeout(r, 20))
    console.log('[repro4] save ran =', logs.includes('save-run'),
      '| editDialogVisible =', t.api().ctx.value._get('editDialogVisible'),
      '| dialog in DOM =', !!t.host.querySelector('.v-dialog'))
    const cancelBtn = Array.from(t.host.querySelectorAll('button')).find(b => b.textContent === '取消') as HTMLButtonElement
    if (t.host.querySelector('.v-dialog')) {
      cancelBtn.click()
      await nextTick()
      await new Promise(r => setTimeout(r, 20))
      console.log('[repro4] cancel ran =', logs.includes('cancel-run'),
        '| editDialogVisible =', t.api().ctx.value._get('editDialogVisible'),
        '| dialog in DOM =', !!t.host.querySelector('.v-dialog'))
    }
    expect(logs).toContain('save-run')
    expect(t.host.querySelector('.v-dialog')).toBeNull()
    t.unmount()
  })
})
