import v8 from 'node:v8'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRuntimeContext } from '@variojs/core'
import { prepareView } from '@variojs/schema'
import { PageSession } from '../../packages/vario-vue/src/runtime/page-session.js'

export type HeapSample = {
  label: string
  gcBefore: number
  heapAfter: number
  retainedBytes: number
  objectCount: number
  snapshotPath: string | null
  collectedAt: string
}

export type HeapReport = {
  samples: HeapSample[]
  slope: number
  collectedAt: string
}

function readHeap(): { used: number; objects: number } {
  const stats = v8.getHeapStatistics()
  return {
    used: stats.used_heap_size,
    objects: stats.number_of_native_contexts + stats.number_of_detached_contexts
  }
}

export function collectGarbage(): void {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc()
    return
  }
  v8.getHeapStatistics()
}

export async function collectGarbageCdp(session: { send: (method: string) => Promise<unknown> }): Promise<void> {
  await session.send('HeapProfiler.enable')
  await session.send('HeapProfiler.collectGarbage')
}

export function runSessionHeapCycle(rounds = 20): HeapSample[] {
  const samples: HeapSample[] = []
  const schema = { type: 'div', children: 'x' } as never
  for (let i = 0; i < rounds; i++) {
    collectGarbage()
    const before = readHeap()
    const sessions: PageSession[] = []
    for (let s = 0; s < 5; s++) {
      sessions.push(new PageSession({
        ctx: createRuntimeContext({ i, s }),
        view: prepareView(schema)
      }))
    }
    for (const session of sessions) session.dispose()
    collectGarbage()
    const after = readHeap()
    samples.push({
      label: `round-${i}`,
      gcBefore: before.used,
      heapAfter: after.used,
      retainedBytes: Math.max(0, after.used - before.used),
      objectCount: after.objects,
      snapshotPath: null,
      collectedAt: new Date().toISOString()
    })
  }
  return samples
}

export function summarizeSlope(samples: HeapSample[]): number {
  if (samples.length < 2) return 0
  const first = samples[0].heapAfter
  const last = samples[samples.length - 1].heapAfter
  return (last - first) / samples.length
}

export function parseHeapSnapshotRetainers(snapshotText: string, needle: string, maxPaths = 3): string[] {
  let data: {
    snapshot: { meta: { node_fields: string[]; edge_fields: string[]; edge_types: unknown[] } }
    nodes: number[]
    edges: number[]
    strings: string[]
  }
  try {
    data = JSON.parse(snapshotText) as typeof data
  } catch (error) {
    return [`parse-error:${error instanceof Error ? error.message : String(error)}`]
  }
  const strings = data.strings ?? []
  const needleIndex = strings.indexOf(needle)
  if (needleIndex < 0) {
    return [`needle-absent:${needle}`]
  }
  const nodeFields = data.snapshot.meta.node_fields
  const edgeFields = data.snapshot.meta.edge_fields
  const edgeTypes = data.snapshot.meta.edge_types[0] as string[]
  const nodeFieldCount = nodeFields.length
  const edgeFieldCount = edgeFields.length
  const nameOffset = nodeFields.indexOf('name')
  const edgeCountOffset = nodeFields.indexOf('edge_count')
  const idOffset = nodeFields.indexOf('id')
  const edgeTypeOffset = edgeFields.indexOf('type')
  const edgeNameOffset = edgeFields.indexOf('name_or_index')
  const toNodeOffset = edgeFields.indexOf('to_node')
  const weakType = edgeTypes.indexOf('weak')
  const nodes = data.nodes
  const edges = data.edges
  const nodeCount = nodes.length / nodeFieldCount
  const incoming: Array<Array<{ from: number; edgeName: string }>> = Array.from({ length: nodeCount }, () => [])
  let edgeCursor = 0
  for (let i = 0; i < nodeCount; i++) {
    const count = nodes[i * nodeFieldCount + edgeCountOffset]
    for (let e = 0; e < count; e++) {
      const base = edgeCursor * edgeFieldCount
      const type = edges[base + edgeTypeOffset]
      const to = edges[base + toNodeOffset] / nodeFieldCount
      if (type !== weakType && to >= 0 && to < nodeCount) {
        const nameOrIndex = edges[base + edgeNameOffset]
        const edgeName = nameOrIndex < strings.length ? strings[nameOrIndex] : String(nameOrIndex)
        incoming[to].push({ from: i, edgeName })
      }
      edgeCursor++
    }
  }
  const stringNodes: number[] = []
  for (let i = 0; i < nodeCount; i++) {
    if (nodes[i * nodeFieldCount + nameOffset] === needleIndex) {
      stringNodes.push(i)
    }
  }
  const owners = new Set<number>()
  for (const node of stringNodes) {
    for (const edge of incoming[node]) owners.add(edge.from)
  }
  const paths: string[] = []
  for (const owner of owners) {
    const chain: string[] = []
    let current = owner
    const seen = new Set<number>()
    for (let depth = 0; depth < 6 && current >= 0 && !seen.has(current); depth++) {
      seen.add(current)
      const nameIndex = nodes[current * nodeFieldCount + nameOffset]
      const id = nodes[current * nodeFieldCount + idOffset]
      const label = nameIndex < strings.length ? strings[nameIndex] : String(nameIndex)
      const inbound = incoming[current][0]
      chain.push(`${label}#${id}${inbound ? `(${inbound.edgeName})` : ''}`)
      current = inbound ? inbound.from : -1
    }
    paths.push(chain.join(' <- '))
    if (paths.length >= maxPaths) break
  }
  return paths.length > 0 ? paths : [`string-node-count:${stringNodes.length}`]
}

const VUE_CYCLE_EDGES = new Set([
  'root', 'parent', 'subTree', 'component', 'vnode', 'ctx', 'proxy', 'refs',
  'setupState', 'props', 'attrs', 'emit', 'slots', 'type', 'appContext',
  'provides', 'scope', 'effect', 'job', 'update', 'render', 'next'
])

export function parseHeapSnapshotHolders(snapshotText: string, needle: string, maxHolders = 12): string[] {
  let data: {
    snapshot: { meta: { node_fields: string[]; edge_fields: string[]; edge_types: unknown[] } }
    nodes: number[]
    edges: number[]
    strings: string[]
  }
  try {
    data = JSON.parse(snapshotText) as typeof data
  } catch (error) {
    return [`parse-error:${error instanceof Error ? error.message : String(error)}`]
  }
  const strings = data.strings ?? []
  const needleIndex = strings.indexOf(needle)
  if (needleIndex < 0) return [`needle-absent:${needle}`]
  const nodeFields = data.snapshot.meta.node_fields
  const edgeFields = data.snapshot.meta.edge_fields
  const edgeTypes = data.snapshot.meta.edge_types[0] as string[]
  const nodeFieldCount = nodeFields.length
  const edgeFieldCount = edgeFields.length
  const nameOffset = nodeFields.indexOf('name')
  const edgeCountOffset = nodeFields.indexOf('edge_count')
  const idOffset = nodeFields.indexOf('id')
  const edgeTypeOffset = edgeFields.indexOf('type')
  const edgeNameOffset = edgeFields.indexOf('name_or_index')
  const toNodeOffset = edgeFields.indexOf('to_node')
  const weakType = edgeTypes.indexOf('weak')
  const nodes = data.nodes
  const edges = data.edges
  const nodeCount = nodes.length / nodeFieldCount
  const incoming: Array<Array<{ from: number; edgeName: string; edgeType: string }>> = Array.from(
    { length: nodeCount },
    () => []
  )
  let edgeCursor = 0
  for (let i = 0; i < nodeCount; i++) {
    const count = nodes[i * nodeFieldCount + edgeCountOffset]
    for (let e = 0; e < count; e++) {
      const base = edgeCursor * edgeFieldCount
      const type = edges[base + edgeTypeOffset]
      const to = edges[base + toNodeOffset] / nodeFieldCount
      if (type !== weakType && to >= 0 && to < nodeCount) {
        const nameOrIndex = edges[base + edgeNameOffset]
        const typeName = edgeTypes[type] ?? String(type)
        const edgeName = typeName === 'element' || typeName === 'hidden'
          ? String(nameOrIndex)
          : (nameOrIndex < strings.length ? strings[nameOrIndex] : String(nameOrIndex))
        incoming[to].push({ from: i, edgeName, edgeType: typeName })
      }
      edgeCursor++
    }
  }
  const owners = new Set<number>()
  for (let i = 0; i < nodeCount; i++) {
    if (nodes[i * nodeFieldCount + nameOffset] === needleIndex) {
      for (const edge of incoming[i]) owners.add(edge.from)
    }
  }
  const holders: string[] = []
  for (const owner of owners) {
    const ownerName = strings[nodes[owner * nodeFieldCount + nameOffset]] ?? '?'
    const id = nodes[owner * nodeFieldCount + idOffset]
    const inbound = incoming[owner]
    const counts = new Map<string, number>()
    for (const edge of inbound) {
      const key = `${edge.edgeType}:${edge.edgeName}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
      if (VUE_CYCLE_EDGES.has(edge.edgeName) || edge.edgeType === 'weak') continue
      const fromName = strings[nodes[edge.from * nodeFieldCount + nameOffset]] ?? '?'
      if (fromName.startsWith('system /')) continue
      const fromId = nodes[edge.from * nodeFieldCount + idOffset]
      holders.push(`${fromName}#${fromId}-[${key}]->${ownerName}#${id}`)
    }
    holders.push(`owner:${ownerName}#${id} inbound=${inbound.length} ${[...counts.entries()].slice(0, 6).map(([k, n]) => `${k}×${n}`).join(',')}`)
    if (holders.length >= maxHolders) break
  }
  return holders.length > 0 ? holders : [`owner-count:${owners.size}`]
}

export function countHeapNodeNames(snapshotText: string, limit = 20): Array<{ name: string; count: number }> {
  let data: {
    snapshot: { meta: { node_fields: string[] } }
    nodes: number[]
    strings: string[]
  }
  try {
    data = JSON.parse(snapshotText) as typeof data
  } catch {
    return [{ name: 'parse-error', count: 0 }]
  }
  const nodeFields = data.snapshot.meta.node_fields
  const nodeFieldCount = nodeFields.length
  const nameOffset = nodeFields.indexOf('name')
  const strings = data.strings
  const nodes = data.nodes
  const nodeCount = nodes.length / nodeFieldCount
  const counts = new Map<string, number>()
  for (let i = 0; i < nodeCount; i++) {
    const nameIndex = nodes[i * nodeFieldCount + nameOffset]
    const name = nameIndex < strings.length ? strings[nameIndex] : String(nameIndex)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

export function countNamedHeapNodes(
  snapshotText: string,
  names: readonly string[]
): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(names.map(name => [name, 0]))
  const wanted = new Set(names)
  let data: {
    snapshot: { meta: { node_fields: string[] } }
    nodes: number[]
    strings: string[]
  }
  try {
    data = JSON.parse(snapshotText) as typeof data
  } catch {
    return result
  }
  const nodeFields = data.snapshot.meta.node_fields
  const nodeFieldCount = nodeFields.length
  const nameOffset = nodeFields.indexOf('name')
  const strings = data.strings
  const nodes = data.nodes
  const nodeCount = nodes.length / nodeFieldCount
  for (let i = 0; i < nodeCount; i++) {
    const nameIndex = nodes[i * nodeFieldCount + nameOffset]
    const name = nameIndex < strings.length ? strings[nameIndex] : String(nameIndex)
    if (wanted.has(name)) result[name] += 1
  }
  return result
}

export function writeHeapReport(dir: string, report: HeapReport): string {
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, 'ssr-memory.json')
  writeFileSync(path, JSON.stringify(report, null, 2))
  return path
}

export function collectHeapReport(rounds = 20): HeapReport {
  const samples = runSessionHeapCycle(rounds)
  return {
    samples,
    slope: summarizeSlope(samples),
    collectedAt: new Date().toISOString()
  }
}
