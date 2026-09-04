/**
 * 生命周期包装模块
 * 
 * 负责创建带生命周期钩子的 Vue 组件
 */

import { h, defineComponent, onMounted, onUnmounted, onUpdated, onBeforeMount, onBeforeUnmount, onBeforeUpdate, onActivated, onDeactivated, type VNode } from 'vue'
import type { RuntimeContext } from '@variojs/types'
import type { VueSchemaNode } from '../types.js'
import { setupProvideInject } from './provide-inject.js'
import { resolvePageSession, getPageSessionForContext } from '../runtime/page-session.js'

/**
 * Schema 属性名 → Vue lifecycle 注册函数的映射表
 * 数据驱动：新增钩子只需加一行，无需复制粘贴
 */
const LIFECYCLE_HOOKS: Array<{
  key: keyof VueSchemaNode
  register: (fn: () => void) => void
}> = [
  { key: 'onBeforeMount', register: onBeforeMount },
  { key: 'onMounted', register: onMounted },
  { key: 'onBeforeUpdate', register: onBeforeUpdate },
  { key: 'onUpdated', register: onUpdated },
  { key: 'onBeforeUnmount', register: onBeforeUnmount },
  { key: 'onUnmounted', register: onUnmounted },
  { key: 'onActivated', register: onActivated },
  { key: 'onDeactivated', register: onDeactivated },
]

export const VarioLifecycleBoundary = defineComponent({
  name: 'VarioLifecycleBoundary',
  inheritAttrs: false,
  props: {
    inner: { type: [Object, String, Function], required: true },
    innerAttrs: { type: Object, required: true },
    innerChildren: { default: null },
    schema: { type: Object, required: false, default: null },
    runtimeCtx: { type: Object, required: false, default: null },
    sessionId: { type: String, default: '' },
    nodeId: { type: String, default: '' }
  },
  setup(props: {
    inner: any
    innerAttrs: Record<string, any>
    innerChildren: any
    schema?: VueSchemaNode | null
    runtimeCtx?: RuntimeContext | null
    sessionId?: string
    nodeId?: string
  }) {
    const session = props.sessionId ? resolvePageSession(props.sessionId) : undefined
    // 优先使用显式传入的 schema / runtimeCtx（T3.3：循环内 lifecycle 拿到对应 $item），
    // session 回落仅用于显式未提供的场景
    const schema = (props.schema ?? (props.nodeId ? session?.source(props.nodeId) : undefined)) as VueSchemaNode | undefined
    const runtimeCtx = (props.runtimeCtx ?? session?.currentLexical() ?? session?.ctx) as RuntimeContext | undefined
    if (!schema || !runtimeCtx) {
      return () => h(props.inner, props.innerAttrs, props.innerChildren)
    }
    const injectedValues = setupProvideInject(schema, runtimeCtx)
    const methods = runtimeCtx.$methods || {}

    for (const { key, register } of LIFECYCLE_HOOKS) {
      const methodName = schema[key] as string | undefined
      if (!methodName) continue
      const hook = methods[methodName]
      if (hook && typeof hook === 'function') {
        register(() => {
          Promise.resolve(hook(runtimeCtx, undefined)).catch((err: unknown) => {
            console.warn(`[Vario] Lifecycle hook "${methodName}" error:`, err)
          })
        })
      }
    }

    return () => h(
      props.inner,
      Object.keys(injectedValues).length > 0
        ? { ...props.innerAttrs, ...injectedValues }
        : props.innerAttrs,
      props.innerChildren
    )
  }
})

/**
 * 生命周期包装器
 */
export class LifecycleWrapper {
  /**
   * 创建带生命周期钩子的组件
   * 使用 defineComponent 包装，确保生命周期钩子在正确的上下文中执行
   */
  createComponentWithLifecycle(
    component: any,
    attrs: Record<string, any>,
    children: any,
    schema: VueSchemaNode,
    ctx: RuntimeContext
  ): VNode {
    const session = getPageSessionForContext(ctx)
    return h(VarioLifecycleBoundary, {
      inner: component,
      innerAttrs: attrs,
      innerChildren: children,
      schema,
      runtimeCtx: ctx,
      sessionId: session?.id,
      nodeId: session?.bySchema.get(schema)?.id
    })
  }
}
