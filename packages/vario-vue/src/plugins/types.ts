/**
 * VNode 插件接口
 *
 * 将 Vue 特有特性（lifecycle/provide-inject/transition/keepAlive/teleport）
 * 从渲染器硬编码逻辑抽离为可组合的插件，实现：
 * - 按需加载：未使用的 Vue 特性不参与渲染管线
 * - 可 tree-shake：打包时可剔除未引用的插件
 * - 清晰边界：schema 核心管线 (cond/show/loop/model/events) 与 Vue 特性解耦
 */

import type { VNode } from 'vue'
import type { RuntimeContext } from '@variojs/types'
import type { VueSchemaNode } from '../types.js'

export interface VNodePlugin {
  /** 插件名称（调试用） */
  name: string

  /**
   * 组件包装阶段：拦截 h(component, attrs, children) 调用
   *
   * 用于需要替换组件创建方式的场景（如 lifecycle/provide-inject
   * 需要用 defineComponent 包装）。
   *
   * @returns VNode — 使用插件生成的 VNode
   * @returns null  — 该插件不处理，继续默认 h()
   */
  wrapComponent?: (
    component: any,
    attrs: Record<string, any>,
    children: any,
    schema: VueSchemaNode,
    ctx: RuntimeContext
  ) => VNode | null

  /**
   * VNode 装饰阶段：在 VNode 创建后依次包装
   *
   * 用于外层包裹场景（transition/keepAlive/teleport）。
   * 多个 decorate 插件按注册顺序依次执行。
   *
   * @returns 装饰后的 VNode（可直接返回原 vnode 表示不处理）
   */
  decorateVNode?: (
    vnode: VNode,
    schema: VueSchemaNode,
    ctx: RuntimeContext
  ) => VNode
}
