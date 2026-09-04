import type { SchemaNode } from '@variojs/types'
import type { ExpectedResult, GeneratedScenario, ScenarioKind, ScenarioParams } from './types.js'

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function token(rng: () => number, prefix: string): string {
  return `${prefix}-${Math.floor(rng() * 100000)}`
}

function countNodes(node: SchemaNode): number {
  let n = 1
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child && typeof child === 'object') n += countNodes(child as SchemaNode)
    }
  }
  return n
}

function depthOf(node: SchemaNode): number {
  if (!Array.isArray(node.children) || node.children.length === 0) return 1
  let max = 1
  for (const child of node.children) {
    if (child && typeof child === 'object') {
      max = Math.max(max, 1 + depthOf(child as SchemaNode))
    }
  }
  return max
}

function makeDeep(depth: number, leafText: string): SchemaNode {
  let node: SchemaNode = { type: 'span', children: leafText }
  for (let i = 1; i < depth; i++) {
    node = { type: 'div', children: [node] }
  }
  return node
}

function makeFlat(n: number, rng: () => number): SchemaNode {
  const children: SchemaNode[] = []
  for (let i = 0; i < n; i++) {
    children.push({ type: 'span', props: { id: token(rng, 'n') }, children: `item-${i}` })
  }
  return { type: 'div', children }
}

function makeDynamic(n: number): SchemaNode {
  const children: SchemaNode[] = []
  for (let i = 0; i < n; i++) {
    children.push({
      type: 'span',
      props: {
        title: '{{ label }}',
        nested: { deep: { text: '{{ label }}' } }
      },
      children: '{{ label }}'
    })
  }
  return { type: 'div', children }
}

function makeLoop(_r: number): SchemaNode {
  return {
    type: 'div',
    loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
    children: [
      { type: 'span', children: '{{ item.label }}-{{ index }}' }
    ]
  }
}

function makeNestedLoop(): SchemaNode {
  return {
    type: 'div',
    loop: { items: 'rows', itemKey: 'row', indexKey: 'ri' },
    children: [
      {
        type: 'div',
        loop: { items: '{{ row.inner }}', itemKey: 'cell', indexKey: 'ci' },
        children: [{ type: 'span', children: '{{ row.id }}:{{ cell }}' }]
      }
    ]
  }
}

function makeMultipage(m: number, rng: () => number): SchemaNode {
  const children: SchemaNode[] = []
  for (let i = 0; i < m; i++) {
    children.push({
      type: 'section',
      id: `page-${i}`,
      cond: `page === ${i}`,
      children: [{ type: 'h1', children: token(rng, 'page') }]
    })
  }
  return { type: 'div', children }
}

const builders: Record<ScenarioKind, (params: ScenarioParams, rng: () => number) => { schema: SchemaNode; state: Record<string, unknown>; mutations: GeneratedScenario['mutations']; expected: ExpectedResult }> = {
  flat: (params, rng) => {
    const schema = makeFlat(params.N, rng)
    return {
      schema,
      state: { label: 'flat' },
      mutations: [{ path: 'label', value: 'flat-updated' }],
      expected: { leafText: 'item-0', nodeCount: countNodes(schema), maxDepth: depthOf(schema), itemCount: params.N }
    }
  },
  deep: (params, rng) => {
    const leafText = token(rng, 'leaf')
    const schema = makeDeep(params.D, leafText)
    return {
      schema,
      state: { label: leafText },
      mutations: [{ path: 'label', value: `${leafText}-u` }],
      expected: { leafText, nodeCount: countNodes(schema), maxDepth: depthOf(schema), itemCount: 1 }
    }
  },
  dynamic: (params) => {
    const schema = makeDynamic(Math.max(1, params.N))
    return {
      schema,
      state: { label: 'dyn' },
      mutations: [{ path: 'label', value: 'dyn-2' }],
      expected: { leafText: 'dyn', nodeCount: countNodes(schema), maxDepth: depthOf(schema), itemCount: params.N }
    }
  },
  loop: (params, rng) => {
    const items = Array.from({ length: params.R }, (_, i) => ({ id: i, label: token(rng, 'it') }))
    const schema = makeLoop(params.R)
    return {
      schema,
      state: { items },
      mutations: [{ path: 'items.0.label', value: 'mutated' }],
      expected: { leafText: `${items[0]?.label}-0`, nodeCount: countNodes(schema), maxDepth: depthOf(schema), itemCount: params.R }
    }
  },
  'nested-loop': (params, rng) => {
    const rows = Array.from({ length: Math.max(1, Math.min(params.R, 8)) }, (_, i) => ({
      id: token(rng, 'row'),
      inner: [token(rng, 'a'), token(rng, 'b')]
    }))
    const schema = makeNestedLoop()
    return {
      schema,
      state: { rows },
      mutations: [{ path: 'rows.0.inner.0', value: 'x' }],
      expected: {
        leafText: `${rows[0].id}:${rows[0].inner[0]}`,
        nodeCount: countNodes(schema),
        maxDepth: depthOf(schema),
        itemCount: rows.length * 2
      }
    }
  },
  multipage: (params, rng) => {
    const schema = makeMultipage(params.M, rng)
    const first = ((schema.children as SchemaNode[])[0].children as SchemaNode[])[0].children as string
    return {
      schema,
      state: { page: 0 },
      mutations: [{ path: 'page', value: Math.max(0, params.M - 1) }],
      expected: { leafText: first, nodeCount: countNodes(schema), maxDepth: depthOf(schema), itemCount: params.M }
    }
  }
}

export function generateScenario(params: ScenarioParams): GeneratedScenario {
  const rng = mulberry32(params.seed)
  const built = builders[params.kind](params, rng)
  return { params, ...built }
}

export function generateMatrix(seed: number): GeneratedScenario[] {
  const kinds: ScenarioKind[] = ['flat', 'deep', 'dynamic', 'loop', 'nested-loop', 'multipage']
  return kinds.map((kind, i) => generateScenario({
    kind,
    seed: seed + i * 17,
    N: 8,
    D: kind === 'deep' ? 20 : 3,
    S: 16,
    R: 6,
    M: 3
  }))
}
