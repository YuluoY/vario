/**
 * Vue 特有的类型定义
 * 
 * 扩展 SchemaNode 以支持 Vue 的特性：
 * - ref: 模板引用（声明映射到 Vue ref）
 * - 生命周期钩子（声明映射到 Vue 钩子）
 * - provide/inject: 依赖注入（声明映射到 Vue API）
 * - teleport: 传送
 * - transition: 过渡动画
 * - keep-alive: 缓存
 * 
 * 注意：computed 和 watch 不在 Schema 中定义，
 * 应该在 Vue 组件中使用原生 API 定义，然后通过 useVario 的 computed 选项传入
 */

import type { SchemaNode } from '@variojs/schema'

/**
 * Vue 特有的 SchemaNode 扩展
 * 深度集成 Vue 3 的 Composition API 特性
 */
export interface VueSchemaNode extends SchemaNode {
  /** 
   * 模板引用名称（类似 Vue 的 ref）
   * 在 useVario 返回的 refs 对象中可以通过此名称访问组件实例
   * 
   * @example
   * // Schema 中
   * { type: 'ElInput', ref: 'inputRef' }
   * 
   * // 使用
   * const { refs } = useVario(schema, options)
   * refs.inputRef.value?.focus() // 访问组件实例
   */
  readonly ref?: string

  /** 
   * 组件挂载后调用（引用 methods 中的方法名）
   */
  readonly onMounted?: string
  /** 
   * 组件卸载前调用（引用 methods 中的方法名）
   */
  readonly onUnmounted?: string
  /** 
   * 组件更新后调用（引用 methods 中的方法名）
   */
  readonly onUpdated?: string
  /** 
   * 组件挂载前调用（引用 methods 中的方法名）
   */
  readonly onBeforeMount?: string
  /** 
   * 组件卸载前调用（引用 methods 中的方法名）
   */
  readonly onBeforeUnmount?: string
  /** 
   * 组件更新前调用（引用 methods 中的方法名）
   */
  readonly onBeforeUpdate?: string

  /**
   * Provide 值（向下传递数据）
   * 
   * 支持表达式：值为字符串时会尝试作为表达式求值
   * 
   * @example
   * { type: 'div', provide: { theme: 'dark', locale: 'currentLocale' } }
   */
  readonly provide?: Record<string, any>

  /**
   * Inject 依赖（从父组件获取数据）
   * 
   * 支持三种形式：
   * - 数组: ['theme', 'locale']
   * - 简单映射: { myTheme: 'theme' }
   * - 完整配置: { myTheme: { from: 'theme', default: 'light' } }
   * 
   * @example
   * { type: 'ElButton', inject: ['theme', 'locale'] }
   * { type: 'ElButton', inject: { myTheme: { from: 'theme', default: 'light' } } }
   */
  readonly inject?: string[] | Record<string, string | { from?: string; default?: any }>

  /**
   * Teleport 目标（将组件传送到指定 DOM 节点）
   * 
   * @example
   * { type: 'div', teleport: 'body' }  // 传送到 body
   * { type: 'div', teleport: '#modal' }  // 传送到 #modal
   */
  readonly teleport?: string | boolean

  /**
   * Transition 配置（过渡动画）
   * 
   * @example
   * { 
   *   type: 'div',
   *   transition: 'fade',  // 使用预设过渡
   *   // 或
   *   transition: {
   *     name: 'fade',
   *     appear: true,
   *     mode: 'out-in'
   *   }
   * }
   */
  readonly transition?: string | {
    name?: string
    appear?: boolean
    mode?: 'default' | 'in-out' | 'out-in'
    duration?: number | { enter?: number; leave?: number }
  }

  /**
   * Keep-alive 配置（缓存组件状态）
   * 
   * @example
   * { type: 'div', keepAlive: true }
   * { type: 'div', keepAlive: { include: 'ComponentA', exclude: 'ComponentB' } }
   */
  readonly keepAlive?: boolean | {
    include?: string | RegExp | Array<string | RegExp>
    exclude?: string | RegExp | Array<string | RegExp>
    max?: number
  }
}
