import type { SchemaNode } from '@variojs/types'

export type ScenarioKind =
  | 'flat'
  | 'deep'
  | 'dynamic'
  | 'loop'
  | 'nested-loop'
  | 'multipage'

export type ScenarioParams = {
  N: number
  D: number
  S: number
  R: number
  M: number
  seed: number
  kind: ScenarioKind
}

export type Mutation = {
  path: string
  value: unknown
}

export type ExpectedResult = {
  leafText: string
  nodeCount: number
  maxDepth: number
  itemCount: number
}

export type GeneratedScenario = {
  params: ScenarioParams
  schema: SchemaNode
  state: Record<string, unknown>
  mutations: Mutation[]
  expected: ExpectedResult
}

export const RUNNER_PROTOCOL = {
  warmup: 20,
  samples: 50,
  processCount: 3,
  modes: ['legacy', 'prepared'] as const
}
