import { h, type VNode } from 'vue'
import type { PreparedNode } from '@variojs/types'
import type { PageSession } from './page-session.js'
import { StaticRegion } from '../components/static-region.js'
import { DynamicRegion } from '../components/dynamic-region.js'
import { LoopRegion } from '../components/loop-region.js'
import { SlotRegion } from '../components/slot-region.js'

function isPureStatic(session: PageSession, id: string): boolean {
  const node = session.node(id)
  if (!node || node.region !== 'static') return false
  return node.childIds.every(childId => isPureStatic(session, childId))
}

function renderStaticHost(session: PageSession, node: PreparedNode): VNode {
  const schema = session.source(node.id)
  const type = schema?.type ?? node.componentType ?? node.type
  const props = schema?.props ? { ...schema.props } : null
  if (node.childIds.length === 0) {
    const children = schema?.children
    if (typeof children === 'string' || typeof children === 'number') {
      return h(type, props, String(children))
    }
    return h(type, props)
  }
  const children = node.childIds
    .map(id => {
      const child = session.node(id)
      if (child?.region === 'static') return renderStaticHost(session, child)
      return renderPreparedNode(session, id)
    })
    .filter((vnode): vnode is VNode => vnode != null)
  return h(type, props, children)
}

export function renderPreparedNode(session: PageSession, nodeId: string): VNode | null {
  const node = session.node(nodeId)
  if (!node) return null
  const props = { sessionId: session.id, regionId: node.id, key: node.id }
  if (node.region === 'loop') return h(LoopRegion, props)
  if (node.region === 'slot') return h(SlotRegion, props)
  if (node.region === 'dynamic' || node.region === 'semantic') {
    return h(DynamicRegion, props)
  }
  if (node.region === 'static' && isPureStatic(session, node.id)) {
    return h(StaticRegion, props)
  }
  return renderStaticHost(session, node)
}

export function installRegionInterceptor(session: PageSession): void {
  if (!session.renderer) return
  session.renderer.regionInterceptor = (schema, _path, _ctx) => {
    const prepared = session.bySchema.get(schema)
    if (!prepared || session.isRendering(prepared.id)) return undefined
    // loop 模板后代：经 LoopItemCell 的 loopCtx 走 legacy 渲染管线（含嵌套 loop），
    // 按 indexView 预计算的静态集合判定，不依赖同步 lexical 栈（T3.1）
    if (session.loopDescendants.has(prepared.id)) return undefined
    if (prepared.region === 'loop') {
      return h(LoopRegion, { sessionId: session.id, regionId: prepared.id, key: prepared.id })
    }
    if (prepared.region === 'slot') {
      return h(SlotRegion, { sessionId: session.id, regionId: prepared.id, key: prepared.id })
    }
    if (prepared.region === 'dynamic' || prepared.region === 'semantic') {
      return h(DynamicRegion, { sessionId: session.id, regionId: prepared.id, key: prepared.id })
    }
    return undefined
  }
}
