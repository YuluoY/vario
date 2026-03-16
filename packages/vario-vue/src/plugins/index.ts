/**
 * VNode 插件系统
 *
 * 提供默认插件集合和按需导入能力：
 * - defaultPlugins: 包含所有 Vue 特性插件（向后兼容）
 * - 各插件单独导出，支持 tree-shake
 */

export type { VNodePlugin } from './types.js'

export { lifecyclePlugin } from './lifecycle.js'
export { keepAlivePlugin } from './keep-alive.js'
export { transitionPlugin } from './transition.js'
export { teleportPlugin } from './teleport.js'

import { lifecyclePlugin } from './lifecycle.js'
import { keepAlivePlugin } from './keep-alive.js'
import { transitionPlugin } from './transition.js'
import { teleportPlugin } from './teleport.js'
import type { VNodePlugin } from './types.js'

/**
 * 默认插件集合（全量 Vue 特性支持）
 *
 * 渲染器未指定 plugins 时使用此集合，保持向后兼容。
 * 顺序：wrapComponent 插件在前，decorateVNode 插件按语义顺序排列
 * （keepAlive → transition → teleport，内层到外层）。
 */
export const defaultPlugins: VNodePlugin[] = [
  lifecyclePlugin,
  keepAlivePlugin,
  transitionPlugin,
  teleportPlugin,
]
