import type { Action } from './action.js'
import type { SchemaNode } from './schema.js'

export type RegionKind = 'static' | 'dynamic' | 'loop' | 'slot' | 'semantic'

export interface VarioDiagnostic {
  readonly code: string
  readonly message: string
  readonly path: string
  readonly phase: string
  readonly engineId?: string
  readonly pageId?: string
  readonly schemaId?: string
  readonly revision?: number
  readonly nodeId?: string
  readonly actionId?: string
  readonly expressionId?: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface ExpressionPlan {
  readonly id: string
  readonly source: string
  readonly stateDeps: readonly string[]
  readonly localDeps: readonly string[]
  readonly dynamicDeps: readonly string[]
  readonly dependencyMode: 'exact' | 'prefix' | 'dynamic'
  readonly ast?: unknown
  readonly pure: boolean
  readonly cost: number
  readonly estimatedCost: number
  readonly policyFingerprint: string
  /** 编译时注入的词法别名集合（祖先 loop 的 itemKey/indexKey），参与 plan id */
  readonly aliases?: readonly string[]
}

export interface LoopPlan {
  readonly nodeId: string
  readonly itemsSource: string
  readonly itemKey: string
  readonly indexKey: string
  readonly keySource: string | null
  readonly templateIds: readonly string[]
  readonly template: SchemaNode
  readonly regionId?: string
  readonly itemsPlanId?: string
  readonly templateNodeId?: string
  readonly itemAlias?: string
  readonly indexAlias?: string
  readonly keyPlanId?: string
  readonly estimatedTemplateNodes?: number
  readonly virtual?: boolean
}

export interface SlotPlan {
  readonly nodeId: string
  readonly name: string
  readonly propNames: readonly string[]
  readonly fallbackIds: readonly string[]
}

export interface PreparedNode {
  readonly id: string
  readonly type: string
  readonly componentType?: string
  readonly path: string
  readonly schemaPath?: string
  readonly depth: number
  readonly parentId: string | null
  readonly childIds: readonly string[]
  readonly childrenIds?: readonly string[]
  readonly region: RegionKind
  readonly regionId?: string
  readonly schema?: SchemaNode
  readonly expressionIds?: readonly string[]
  readonly dynamicPlans?: readonly string[]
  readonly dynamicProps?: Readonly<Record<string, string>>
  readonly textPlan?: { readonly planId: string }
  readonly conditionPlan?: string
  readonly showPlan?: string
  readonly eventPlans?: Readonly<Record<string, readonly Action[]>>
  readonly modelPlans?: readonly { readonly path: string }[]
  readonly staticAttrs?: Readonly<Record<string, unknown>>
  readonly staticProps?: Readonly<Record<string, unknown>>
  readonly flags?: number
  readonly featureFlags?: number
  readonly loopPlanId?: string
  readonly slotPlanId?: string
}

export interface PreparedRegion {
  readonly id?: string
  readonly kind: RegionKind
  readonly nodeIds: readonly string[]
}

export type PathPlan = string

export interface RuntimeBudget {
  readonly maxDepth: number
  readonly maxNodes: number
  readonly maxExpandedNodes: number
  readonly maxDirtyRegionsPerTick?: number
  readonly maxActivePages?: number
  readonly maxLoopItemsPerRegion?: number
  readonly maxExpandedNodesPerPage?: number
  readonly maxActiveLoopCells?: number
  readonly maxScopeDepth?: number
  /** prepared 专用：state 用 deep reactive + sync deep watch，直接改 state 路由为 recordChange（T3.5） */
  readonly deepStateWatch?: boolean
}

export interface PreparedStats {
  readonly nodeCount: number
  readonly maxDepth: number
  readonly expressionCount: number
  readonly loopCount: number
}

export interface PreparedView {
  readonly id?: string
  readonly revision: number
  readonly rootNodeId?: string
  readonly rootId?: string
  readonly nodes: ReadonlyMap<string, PreparedNode>
  readonly nodeList?: readonly PreparedNode[]
  readonly nodeMap?: ReadonlyMap<string, PreparedNode>
  readonly regions: ReadonlyMap<string, PreparedRegion>
  readonly regionList?: readonly PreparedRegion[]
  readonly regionMap?: ReadonlyMap<string, PreparedRegion>
  readonly idMap: ReadonlyMap<string, string>
  readonly diagnostics: readonly VarioDiagnostic[]
  readonly expressions: ReadonlyMap<string, ExpressionPlan>
  readonly actions: ReadonlyMap<string, Readonly<Record<string, readonly Action[]>>>
  readonly loops: ReadonlyMap<string, LoopPlan>
  readonly slots: ReadonlyMap<string, SlotPlan>
  readonly nodeCount: number
  readonly maxDepth: number
  readonly stats?: PreparedStats
  readonly legacyRequired?: boolean
}

export interface ChangeRecord {
  readonly path: string
  readonly value: unknown
}

export interface ChangeSet {
  readonly id: number
  readonly transactionId?: string
  readonly paths: readonly string[]
  readonly records: readonly ChangeRecord[]
  readonly versions?: Readonly<Record<string, number>>
}
