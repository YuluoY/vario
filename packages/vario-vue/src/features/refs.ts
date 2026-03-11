/**
 * Ref 支持
 * 
 * 实现 Vue 的模板引用功能，允许在 Schema 中声明 ref，
 * 并通过 useVario 返回的 refs 对象访问组件实例
 */

import { ref, type Ref } from 'vue'
import type { ComponentInternalInstance, VNode } from 'vue'
import type { VueSchemaNode } from '../types.js'

type SupportedTemplateRef = Ref<any> | ((...args: any[]) => any) | string

type NormalizedVNodeRef = {
  i: ComponentInternalInstance | null
  r: SupportedTemplateRef
  k?: string
  f?: boolean
}

function isSupportedTemplateRef(value: unknown): value is SupportedTemplateRef {
  return typeof value === 'string' ||
    typeof value === 'function' ||
    (!!value && typeof value === 'object' && 'value' in value)
}

function isNormalizedVNodeRef(value: unknown): value is NormalizedVNodeRef {
  return !!value && typeof value === 'object' && 'i' in value && 'r' in value
}

function normalizeVNodeRefs(
  value: unknown,
  owner: ComponentInternalInstance | null
): NormalizedVNodeRef[] {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(item => normalizeVNodeRefs(item, owner))
  }

  if (isNormalizedVNodeRef(value)) {
    return [value]
  }

  if (isSupportedTemplateRef(value)) {
    return [{ i: owner, r: value }]
  }

  return []
}

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
  refsRegistry: RefsRegistry,
  owner: ComponentInternalInstance | null = null
): VNode {
  if (!schema.ref) {
    return vnode
  }

  const refValue = refsRegistry.register(schema.ref)
  const vnodeAny = vnode as any
  const existingNormalizedRefs = normalizeVNodeRefs(vnodeAny.ref, owner)
  const resolvedOwner = owner || existingNormalizedRefs.find(refAtom => refAtom.i)?.i || null

  if (!resolvedOwner) {
    return vnode
  }

  const normalizedRef: NormalizedVNodeRef = {
    i: resolvedOwner,
    r: refValue,
    k: schema.ref
  }

  const mergedRefs = existingNormalizedRefs.length > 0
    ? [...normalizeVNodeRefs(vnodeAny.ref, resolvedOwner), normalizedRef]
    : normalizedRef

  vnodeAny.ref = mergedRefs

  return vnode
}
