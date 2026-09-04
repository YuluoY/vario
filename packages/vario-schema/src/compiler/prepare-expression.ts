import type { ExpressionPlan, SchemaNode } from '@variojs/types'
import { compileExpressionPlan } from '@variojs/core'

const MUSTACHE = /\{\{\s*([^}]+?)\s*\}\}/g

/**
 * SchemaNode 特征：type 为字符串且带有节点结构字段。
 * 子节点由各自的 collectNodeExpressionSources 单独处理；
 * 若在此深入遍历，深链下每个节点都会重扫整棵子树（O(N²)）并随深度递归栈溢出。
 */
function isSchemaNodeLike(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const rec = value as Record<string, unknown>
  if (typeof rec.type !== 'string') return false
  return 'children' in rec || 'props' in rec || 'loop' in rec || 'events' in rec || 'cond' in rec
}

export function collectExpressionSources(value: unknown, into: Set<string> = new Set()): Set<string> {
  // 显式栈遍历：避免深度递归栈溢出（PERF-A6 深树 prepare）
  const stack: unknown[] = [value]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (typeof current === 'string') {
      MUSTACHE.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = MUSTACHE.exec(current))) {
        into.add(match[1].trim())
      }
      continue
    }
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i--) stack.push(current[i])
      continue
    }
    if (current && typeof current === 'object' && !isSchemaNodeLike(current)) {
      for (const item of Object.values(current as Record<string, unknown>)) stack.push(item)
    }
  }
  return into
}

export function collectNodeExpressionSources(node: SchemaNode): string[] {
  const sources = new Set<string>()
  collectExpressionSources(node.props, sources)
  collectExpressionSources(node.children, sources)
  collectExpressionSources((node as { cond?: unknown }).cond, sources)
  collectExpressionSources((node as { show?: unknown }).show, sources)
  if (node.loop?.items && typeof node.loop.items === 'string') {
    const raw = node.loop.items
    const source = raw.startsWith('{{') ? raw.replace(/^\{\{|\}\}$/g, '').trim() : raw
    sources.add(source)
  }
  const events = (node as { events?: Record<string, unknown> }).events
  if (events) collectExpressionSources(events, sources)
  return [...sources]
}

export function compileExpressionSources(
  sources: Iterable<string>,
  into: Map<string, ExpressionPlan>,
  aliases: readonly string[] = []
): string[] {
  const expressionIds: string[] = []
  for (const source of sources) {
    if (!source) continue
    const plan = compileExpressionPlan(source, aliases.length > 0 ? { aliases } : undefined)
    into.set(plan.id, plan)
    expressionIds.push(plan.id)
  }
  return expressionIds
}
