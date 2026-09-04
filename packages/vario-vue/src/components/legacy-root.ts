import { defineComponent, type VNode } from 'vue'

/**
 * legacy 渲染宿主（对齐 prepared 的 VarioRoot）：渲染发生在本组件的 render
 * 函数内，满足 Vue withDirectives 只能在 render 函数内调用的约束（KG-6/KG-14）；
 * 宿主只渲染 h(VarioLegacyRoot, { revision })，不再追踪整棵 state。
 */
export const VarioLegacyRoot = defineComponent({
  name: 'VarioLegacyRoot',
  props: {
    renderFn: { type: Function, required: true },
    revision: { type: Number, default: 0 }
  },
  setup(props: { renderFn: () => VNode | null; revision: number }) {
    // 读取 props.revision：宿主递增 revision 触发本组件重渲染（同一实例，
    // directive updated 钩子按 Vue 语义触发），而非 key 变更导致的重建
    return () => {
      void props.revision
      return props.renderFn()
    }
  }
})

/** 应急开关：'component'（默认）走内部组件；'inline' 恢复旧 getter 直出（带指令缺陷，仅应急） */
export const LEGACY_HOST_MODE: 'component' | 'inline' = 'component'
