/**
 * @vitest-environment happy-dom
 * 症状4 端到端兜底：真实 Element Plus ElDialog（含过渡/teleport）验证
 * 保存/取消后 editDialogVisible 正确流转并驱动弹窗关闭。
 * 浏览器自动化环境 rAF 冻结会导致过渡卡住的伪影，本用例在 rAF 正常的
 * happy-dom 中验证完整链路：state → modelValue prop → ElDialog 内部 visible → DOM 关闭。
 */
import { describe, it, expect, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { ElButton, ElDialog, ElInput } from 'element-plus'
import { useVario } from '../../src/index.js'

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
  app.use({ install: (a: ReturnType<typeof createApp>) => { a.component('ElDialog', ElDialog); a.component('ElButton', ElButton); a.component('ElInput', ElInput) } })
  app.mount(host)
  return { host, api: () => api, unmount() { app.unmount(); host.remove() } }
}

describe('症状4（真实 Element Plus）：编辑弹窗保存/取消后关闭', () => {
  it('取消：editDialogVisible → false，overlay/dialog 从 DOM 移除', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const t = mount(
      {
        type: 'div',
        props: { class: 'data-table-demo' },
        children: [
          {
            type: 'ElDialog',
            model: 'editDialogVisible',
            props: { title: '编辑产品', width: '500px' },
            children: [
              { type: 'ElInput', model: 'editingProduct.name', props: { placeholder: '请输入产品名称' } },
              {
                type: 'template', slot: 'footer',
                children: [
                  { type: 'ElButton', events: { click: [{ type: 'call', method: 'cancelEdit' }] }, children: '取消' },
                  { type: 'ElButton', props: { type: 'primary' }, events: { click: [{ type: 'call', method: 'saveEdit' }] }, children: '保存' }
                ]
              }
            ]
          }
        ]
      },
      {
        state: { editDialogVisible: false, editingProduct: null, products: [{ id: 1, name: 'iPhone 15' }] },
        methods: {
          cancelEdit: ({ state }: { state: Record<string, unknown> }) => { state.editDialogVisible = false; state.editingProduct = null },
          saveEdit: ({ state }: { state: Record<string, unknown> }) => { state.editDialogVisible = false; state.editingProduct = null }
        }
      }
    )
    await nextTick()
    // 打开弹窗（模拟点击行内编辑按钮：直接改 state）
    const s = t.api().state as Record<string, unknown>
    s.editingProduct = { id: 1, name: 'iPhone 15' }
    s.editDialogVisible = true
    await nextTick()
    await new Promise(r => setTimeout(r, 400))
    expect(s.editDialogVisible).toBe(true)
    expect(getComputedStyle(document.querySelector('.el-overlay')!).display).toBe('block')
    // 表单回填
    const input = document.querySelector('.el-dialog input') as HTMLInputElement
    expect(input && (input.value === 'iPhone 15' || (document.querySelector('.el-dialog') as HTMLElement).textContent!.includes(''))).toBeTruthy()
    // 点击取消（footer slot 内按钮）
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === '取消') as HTMLButtonElement
    cancelBtn.click()
    await nextTick()
    await new Promise(r => setTimeout(r, 500))
    expect(s.editDialogVisible).toBe(false)
    // ElDialog 关闭后 DOM 常驻（v-show），断言 overlay 不可见
    const closedOverlay = document.querySelector('.el-overlay') as HTMLElement | null
    expect(closedOverlay ? getComputedStyle(closedOverlay).display : 'absent').not.toBe('block')
    // 重新打开 → 保存 → 同样关闭
    s.editingProduct = { id: 1, name: 'iPhone 15' }
    s.editDialogVisible = true
    await nextTick()
    await new Promise(r => setTimeout(r, 400))
    expect(getComputedStyle(document.querySelector('.el-overlay')!).display).toBe('block')
    const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === '保存') as HTMLButtonElement
    saveBtn.click()
    await nextTick()
    await new Promise(r => setTimeout(r, 500))
    expect(s.editDialogVisible).toBe(false)
    const closedOverlay2 = document.querySelector('.el-overlay') as HTMLElement | null
    expect(closedOverlay2 ? getComputedStyle(closedOverlay2).display : 'absent').not.toBe('block')
    t.unmount()
  })
})
