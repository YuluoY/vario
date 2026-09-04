/**
 * @vitest-environment happy-dom
 * 症状4 精确复刻：data-table 编辑弹窗（model 嵌套 + editingProduct=null）
 */
import { describe, it, expect, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { useVario } from '../../src/index.js'

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
  app.component('VDialog', VDialog)
  app.component('VInput', VInput)
  app.mount(host)
  return { host, api: () => api, unmount() { app.unmount(); host.remove() } }
}

describe('症状4：编辑弹窗保存不关闭', () => {
  it('data-table dialog 结构：saveEdit（products 索引赋值 + visible=false + editingProduct=null）', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const logs: string[] = []
    const t = mount(
      {
        type: 'div',
        children: [
          {
            type: 'VDialog', model: 'editDialogVisible', props: { title: '编辑产品' },
            children: [
              { type: 'VInput', model: 'editingProduct.name', props: { placeholder: '请输入产品名称' } },
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
        state: {
          products: [{ id: 1, name: 'p1', price: 1, stock: 1, status: 'active', category: 'a' }],
          editDialogVisible: false,
          editingProduct: null
        },
        methods: {
          editProduct: ({ state, params }: { state: Record<string, unknown>; params: { id: number } }) => {
            const p = (state.products as Array<Record<string, unknown>>).find(x => x.id === params.id)
            if (p) { state.editingProduct = { ...p }; state.editDialogVisible = true }
          },
          saveEdit: ({ state }: { state: Record<string, unknown> }) => {
            logs.push('save-run')
            const editing = state.editingProduct as Record<string, unknown> | null
            if (editing) {
              const products = state.products as Array<Record<string, unknown>>
              const index = products.findIndex(p => p.id === editing.id)
              if (index !== -1) products[index] = { ...editing }
            }
            state.editDialogVisible = false
            state.editingProduct = null
          },
          cancelEdit: ({ state }: { state: Record<string, unknown> }) => {
            logs.push('cancel-run')
            state.editDialogVisible = false
            state.editingProduct = null
          }
        }
      }
    )
    await nextTick()
    // 打开弹窗
    t.api().ctx.value._get('products')
    ;(t.api().state as Record<string, unknown>).products = t.api().ctx.value._get('products')
    const st = t.api().state as Record<string, unknown>
    st.editingProduct = { ...(st.products as Array<Record<string, unknown>>)[0] }
    st.editDialogVisible = true
    await nextTick()
    expect(t.host.querySelector('.v-dialog')).toBeTruthy()
    // 保存
    const saveBtn = Array.from(t.host.querySelectorAll('button')).find(b => b.textContent === '保存') as HTMLButtonElement
    saveBtn.click()
    await nextTick()
    await new Promise(r => setTimeout(r, 30))
    console.log('[repro-table] save ran =', logs.includes('save-run'),
      '| editDialogVisible =', JSON.stringify((t.api().state as Record<string, unknown>).editDialogVisible),
      '| editingProduct =', JSON.stringify((t.api().state as Record<string, unknown>).editingProduct),
      '| dialog in DOM =', !!t.host.querySelector('.v-dialog'))
    expect((t.api().state as Record<string, unknown>).editDialogVisible).toBe(false)
    expect(t.host.querySelector('.v-dialog')).toBeNull()
    t.unmount()
  })
})

describe("症状4 根因B：组件化路径的 model 路径栈错位", () => {
  it("后代 ≥5 的含 model 组件（触发 VarioNode 组件化）不应把自身段拼进 model 路径", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    // 后代数 ≥5 → shouldComponentize → VarioNode（features/vario-node.ts）
    const filler = Array.from({ length: 6 }, (_, i) => ({ type: "span", children: `f${i}` }))
    const t = mount(
      {
        type: "div",
        children: [
          {
            type: "VDialog", model: "editDialogVisible", props: { title: "编辑" },
            children: [
              { type: "VInput", model: "editingProduct.name", props: { placeholder: "名称" } },
              ...filler,
              {
                type: "template", slot: "footer",
                children: [{ type: "button", events: { click: [{ type: "call", method: "cancelEdit" }] }, children: "取消" }]
              }
            ]
          }
        ]
      },
      {
        state: { editDialogVisible: false, editingProduct: null },
        methods: {
          cancelEdit: ({ state }: { state: Record<string, unknown> }) => {
            state.editDialogVisible = false
          }
        }
      }
    )
    await nextTick()
    await new Promise(r => setTimeout(r, 20))
    const edv = (t.api().state as Record<string, unknown>).editDialogVisible
    console.log("[repro-componentized] editDialogVisible =", JSON.stringify(edv))
    // 期望：保持 boolean false；实际（bug）：被预写成 { editDialogVisible: "" }
    expect(edv).toBe(false)
    t.unmount()
  })
})
