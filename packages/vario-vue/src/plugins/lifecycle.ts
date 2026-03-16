/**
 * 生命周期 + Provide/Inject 插件
 *
 * 当 schema 节点声明了 onMounted/onUnmounted 等生命周期钩子，
 * 或 provide/inject 依赖注入时，用 defineComponent 包装组件。
 */

import type { VNode } from 'vue'
import type { RuntimeContext } from '@variojs/types'
import type { VueSchemaNode } from '../types.js'
import type { VNodePlugin } from './types.js'
import { LifecycleWrapper } from '../features/lifecycle-wrapper.js'

const wrapper = new LifecycleWrapper()

export const lifecyclePlugin: VNodePlugin = {
  name: 'lifecycle',

  wrapComponent(
    component: any,
    attrs: Record<string, any>,
    children: any,
    schema: VueSchemaNode,
    ctx: RuntimeContext
  ): VNode | null {
    const hasLifecycle = schema.onMounted || schema.onUnmounted || schema.onUpdated
      || schema.onBeforeMount || schema.onBeforeUnmount || schema.onBeforeUpdate

    const hasProvideInject =
      (schema.provide && Object.keys(schema.provide).length > 0)
      || (schema.inject && (
        Array.isArray(schema.inject) ? schema.inject.length > 0 : Object.keys(schema.inject).length > 0
      ))

    if (!hasLifecycle && !hasProvideInject) return null

    return wrapper.createComponentWithLifecycle(component, attrs, children, schema, ctx)
  }
}
