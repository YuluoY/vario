/**
 * Ref 支持
 * 
 * 实现 Vue 的模板引用功能，允许在 Schema 中声明 ref，
 * 并通过 useVario 返回的 refs 对象访问组件实例
 */

import { ref, type Ref } from 'vue'
import type { VNode } from 'vue'
import type { VueSchemaNode } from '../types.js'

/**
 * Refs 注册表
 * 存储所有通过 ref 属性声明的组件引用
 * 
 * 使用 Proxy 实现动态访问：用户可以通过 refs.xxx 访问任何 ref，
 * 如果 ref 不存在会自动创建（懒加载）
 */
export class RefsRegistry {
  private refs = new Map<string, Ref<any>>()
  private _proxy: Record<string, Ref<any>> | null = null

  /**
   * 注册一个 ref
   */
  register(name: string): Ref<any> {
    if (!this.refs.has(name)) {
      this.refs.set(name, ref(null))
    }
    return this.refs.get(name)!
  }

  /**
   * 获取所有 refs（返回动态 Proxy，可以访问后续添加的 ref）
   */
  getAll(): Record<string, Ref<any>> {
    if (!this._proxy) {
      this._proxy = new Proxy({} as Record<string, Ref<any>>, {
        get: (_, prop: string) => {
          // 自动注册并返回 ref
          return this.register(prop)
        },
        ownKeys: () => {
          return Array.from(this.refs.keys())
        },
        getOwnPropertyDescriptor: (_, prop: string) => {
          if (this.refs.has(prop)) {
            return { enumerable: true, configurable: true, value: this.refs.get(prop) }
          }
          return undefined
        },
        has: (_, prop: string) => {
          return this.refs.has(prop)
        }
      })
    }
    return this._proxy
  }

  /**
   * 获取指定的 ref
   */
  get(name: string): Ref<any> | undefined {
    return this.refs.get(name)
  }

  /**
   * 清除所有 refs（组件卸载时调用）
   */
  clear(): void {
    this.refs.clear()
  }
  
  /**
   * 移除指定的 ref
   */
  remove(name: string): boolean {
    return this.refs.delete(name)
  }
}

/**
 * 为 VNode 添加 ref 处理
 */
export function attachRef(
  vnode: VNode,
  schema: VueSchemaNode,
  refsRegistry: RefsRegistry
): VNode {
  if (!schema.ref) {
    return vnode
  }

  const refValue = refsRegistry.register(schema.ref)
  
  // 使用类型断言处理 ref（Vue 的 ref 类型比较复杂）
  const vnodeAny = vnode as any
  
  // 如果 vnode 已经有 ref，需要合并处理
  if (vnodeAny.ref) {
    const existingRef = vnodeAny.ref
    const refCallback = (el: any) => {
      // 调用原有的 ref
      if (typeof existingRef === 'function') {
        try {
          existingRef(el)
        } catch (e) {
          // 忽略错误
        }
      } else if (existingRef && typeof existingRef === 'object' && 'value' in existingRef) {
        try {
          (existingRef as any).value = el
        } catch (e) {
          // 忽略错误
        }
      }
      // 设置到我们的 ref
      refValue.value = el
    }
    vnodeAny.ref = refCallback
  } else {
    vnodeAny.ref = refValue
  }

  return vnode
}
