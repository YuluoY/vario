/**
 * 循环数据源路径映射（替代 schema.__loopItems 隐式属性）
 *
 * loop-handler 写入，path-resolver 读取。
 * WeakMap 以 SchemaNode 为 key，GC 自动回收。
 */

import type { SchemaNode } from '@variojs/schema'

export const loopItemsMap = new WeakMap<SchemaNode, string>()
