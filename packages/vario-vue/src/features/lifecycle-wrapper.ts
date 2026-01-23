/**
 * 生命周期包装模块
 * 
 * 负责创建带生命周期钩子的 Vue 组件
 */

import { h, defineComponent, onMounted, onUnmounted, onUpdated, onBeforeMount, onBeforeUnmount, onBeforeUpdate, type VNode } from 'vue'
import type { RuntimeContext } from '@vario/core'
import type { VueSchemaNode } from '../types.js'
import { setupProvideInject } from './provide-inject.js'

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
    return h(defineComponent({
      name: 'VarioLifecycleWrapper',
      setup() {
        // 从 ctx.$methods 中查找生命周期钩子方法
        const methods = ctx.$methods || {}
        
        // 处理 provide/inject（在 setup 中调用）
        const injectedValues = setupProvideInject(schema, ctx)
        
        // 合并 inject 的值到 attrs
        const mergedAttrs = Object.keys(injectedValues).length > 0
          ? { ...attrs, ...injectedValues }
          : attrs
        
        // 注册生命周期钩子（按 Vue 3 生命周期顺序）
        // 从 ctx.$methods 中查找对应的方法并注册为生命周期钩子
        if (schema.onBeforeMount) {
          const methodName = schema.onBeforeMount
          const hook = methods[methodName]
          if (hook && typeof hook === 'function') {
            onBeforeMount(() => {
              Promise.resolve(hook(ctx, undefined)).catch((err: unknown) => {
                console.warn(`[Vario] Lifecycle hook "${methodName}" error:`, err)
              })
            })
          }
        }
        
        if (schema.onMounted) {
          const methodName = schema.onMounted
          const hook = methods[methodName]
          if (hook && typeof hook === 'function') {
            onMounted(() => {
              Promise.resolve(hook(ctx, undefined)).catch((err: unknown) => {
                console.warn(`[Vario] Lifecycle hook "${methodName}" error:`, err)
              })
            })
          }
        }
        
        if (schema.onBeforeUpdate) {
          const methodName = schema.onBeforeUpdate
          const hook = methods[methodName]
          if (hook && typeof hook === 'function') {
            onBeforeUpdate(() => {
              Promise.resolve(hook(ctx, undefined)).catch((err: unknown) => {
                console.warn(`[Vario] Lifecycle hook "${methodName}" error:`, err)
              })
            })
          }
        }
        
        if (schema.onUpdated) {
          const methodName = schema.onUpdated
          const hook = methods[methodName]
          if (hook && typeof hook === 'function') {
            onUpdated(() => {
              Promise.resolve(hook(ctx, undefined)).catch((err: unknown) => {
                console.warn(`[Vario] Lifecycle hook "${methodName}" error:`, err)
              })
            })
          }
        }
        
        if (schema.onBeforeUnmount) {
          const methodName = schema.onBeforeUnmount
          const hook = methods[methodName]
          if (hook && typeof hook === 'function') {
            onBeforeUnmount(() => {
              Promise.resolve(hook(ctx, undefined)).catch((err: unknown) => {
                console.warn(`[Vario] Lifecycle hook "${methodName}" error:`, err)
              })
            })
          }
        }
        
        if (schema.onUnmounted) {
          const methodName = schema.onUnmounted
          const hook = methods[methodName]
          if (hook && typeof hook === 'function') {
            onUnmounted(() => {
              Promise.resolve(hook(ctx, undefined)).catch((err: unknown) => {
                console.warn(`[Vario] Lifecycle hook "${methodName}" error:`, err)
              })
            })
          }
        }

        // 返回渲染函数（使用合并后的 attrs）
        return () => h(component, mergedAttrs, children)
      }
    }))
  }
}
