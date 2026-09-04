/**
 * Proxy 沙箱实现
 * 
 * 功能：
 * - 防止覆盖系统 API（$ 和 _ 前缀保护）
 * - 拦截属性设置操作
 * - 当 ReactiveAdapter 存在时，将状态属性的 get/set/has/ownKeys 路由到 adapter
 */

import type { RuntimeContext, ReactiveAdapter } from '@variojs/types'
import { recordChange } from './change-set.js'
import { invalidateCache } from '../expression/cache.js'
import { isContextDisposed, emitContextDiagnostic } from './runtime-session.js'
import { ErrorCodes } from '../errors.js'

/**
 * 创建受保护的 Proxy 上下文
 * 禁止设置以 $ 或 _ 开头的属性
 * 
 * @template T 上下文类型，必须是 RuntimeContext 的子类型
 * @param ctx 运行时上下文对象
 * @param adapter 可选的响应式适配器，提供后状态读写路由到 adapter
 * @returns 受保护的 Proxy 包装的上下文
 */
export function createProxy<T extends RuntimeContext>(ctx: T, adapter?: ReactiveAdapter): T {
  // 允许设置和删除的特殊变量（循环/事件上下文变量；vario-vue 节点关系扩展；weft 命名空间注入）
  // 注意：$methods 不在此列表中，不允许被整体覆盖
  const allowedSpecialVars = [
    '$event',
    '$item',
    '$index',
    '$self',
    '$parent',
    '$siblings',
    '$children',
    // weft 命名空间：由宿主应用注入，运行时可更新
    '$variables',
    '$datasources',
    '$functions',
    '$utils'
  ]

  /**
   * 判断一个属性是否为"状态属性"（非系统 API、非 Symbol）
   * 状态属性应当路由到 adapter
   */
  const isStateKey = (prop: string | symbol): prop is string => {
    if (typeof prop === 'symbol') return false
    const key = prop as string
    return !key.startsWith('$') && !key.startsWith('_')
  }
  
  const proxy: T = new Proxy(ctx, {
    set(target, prop, value, receiver) {
      const propName = String(prop)

      // 禁止覆盖系统 API
      if (propName.startsWith('$') || propName.startsWith('_')) {
        // 允许设置特殊变量
        if (allowedSpecialVars.includes(propName)) {
          // 传 receiver：当此 proxy 作为原型（如 Object.create(proxy)）时，
          // 子对象上的赋值应在子对象（receiver）上创建自有属性，而非污染 target。
          const ok = Reflect.set(target, prop, value, receiver)
          if (ok) {
            // 特殊变量（$event/$self/...）赋值即失效相关缓存（FR-3）
            invalidateCache(propName, proxy)
          }
          return ok
        }

        throw new Error(
          `Cannot override system API: ${propName}. ` +
          `Properties starting with "$" or "_" are protected.`
        )
      }

      // 有 adapter 时，状态写入路由到 adapter
      // 但仅当直接在 proxy 上设置时路由；通过原型链继承的对象（如 loopCtx = Object.create(proxy)）
      // 上设置局部变量（如 item/index）时，应在 receiver 上创建自有属性，
      // 否则会误写入 Vue reactiveState，触发 VarioNode 递归更新。
      if (adapter && isStateKey(prop)) {
        if (receiver === proxy) {
          if (isContextDisposed(proxy)) {
            // disposed 后写入：静默忽略 + 诊断（FR-7）
            emitContextDiagnostic(proxy, {
              name: 'state-write',
              diagnostic: {
                code: ErrorCodes.SESSION_DISPOSED_WRITE,
                message: 'write to disposed context ignored',
                path: propName,
                phase: 'runtime'
              }
            })
            return true
          }
          adapter.setProperty(propName, value)
          invalidateCache(propName, proxy)
          recordChange(proxy, propName, value)
          return true
        }
        return Reflect.set(target, prop, value, receiver)
      }

      if (isStateKey(prop) && receiver === proxy) {
        if (isContextDisposed(proxy)) {
          emitContextDiagnostic(proxy, {
            name: 'state-write',
            diagnostic: {
              code: ErrorCodes.SESSION_DISPOSED_WRITE,
              message: 'write to disposed context ignored',
              path: propName,
              phase: 'runtime'
            }
          })
          return true
        }
        const ok = Reflect.set(target, prop, value, receiver)
        if (ok) {
          invalidateCache(propName, proxy)
          recordChange(proxy, propName, value)
        }
        return ok
      }

      return Reflect.set(target, prop, value, receiver)
    },
    
    get(target, prop) {
      // 有 adapter 时，状态读取路由到 adapter
      if (adapter && typeof prop === 'string' && isStateKey(prop)) {
        // 优先从 target 查找（adapter 不一定有所有 key，如方法名等）
        // 只有 adapter.has(key) 时才路由
        if (adapter.has(prop)) {
          return adapter.getProperty(prop)
        }
      }
      return Reflect.get(target, prop)
    },
    
    has(target, prop) {
      // 有 adapter 时，状态属性的 'in' 操作检查 adapter
      if (adapter && typeof prop === 'string' && isStateKey(prop)) {
        if (adapter.has(prop)) return true
      }
      return Reflect.has(target, prop)
    },

    ownKeys(target) {
      const targetKeys = Reflect.ownKeys(target)
      if (adapter) {
        // 合并 adapter 的状态 keys 和 target 的系统 keys，去重
        const adapterKeys = adapter.keys()
        const allKeys = new Set<string | symbol>(targetKeys)
        for (const key of adapterKeys) {
          allKeys.add(key)
        }
        return [...allKeys]
      }
      return targetKeys
    },

    getOwnPropertyDescriptor(target, prop) {
      // 有 adapter 时，为 adapter 管理的状态属性返回正确的描述符
      // 这使得 for...in、Object.keys() 等能正确遍历
      if (adapter && typeof prop === 'string' && isStateKey(prop) && adapter.has(prop)) {
        return {
          configurable: true,
          enumerable: true,
          get: () => adapter.getProperty(prop),
          set: (value: unknown) => {
            adapter.setProperty(prop, value)
            invalidateCache(prop, proxy)
            recordChange(proxy, prop, value)
          }
        }
      }
      return Reflect.getOwnPropertyDescriptor(target, prop)
    },
    
    deleteProperty(target, prop) {
      const propName = String(prop)
      
      // 禁止删除系统 API
      if (propName.startsWith('$') || propName.startsWith('_')) {
        // 允许删除特殊变量
        if (allowedSpecialVars.includes(propName)) {
          return Reflect.deleteProperty(target, prop)
        }
        throw new Error(`Cannot delete system API: ${propName}`)
      }
      
      return Reflect.deleteProperty(target, prop)
    }
  })
  return proxy
}
