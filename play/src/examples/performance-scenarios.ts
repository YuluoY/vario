import type { Schema } from '@variojs/schema'
import { createSimpleButtonsSchema } from './performance-simple-buttons'
import { createNestedCardsSchema } from './performance-nested-cards'
import { createFormComponentsSchema } from './performance-form-components'
import { createGridLayoutSchema } from './performance-grid-layout'
import { createTreeStructureSchema } from './performance-tree-structure'
import { createMixedComplexSchema } from './performance-mixed-complex'
import { createDeepNestingSchema } from './performance-deep-nesting'
import { createTableRowsSchema } from './performance-table-rows'

export type TestScenario = 
  | 'simpleButtons'
  | 'nestedCards'
  | 'formComponents'
  | 'gridLayout'
  | 'treeStructure'
  | 'mixedComplex'
  | 'deepNesting'
  | 'tableRows'

export type ScenarioSchemaFactory = (componentCount: number) => Schema

export const scenarioFactories: Record<TestScenario, ScenarioSchemaFactory> = {
  simpleButtons: createSimpleButtonsSchema,
  nestedCards: createNestedCardsSchema,
  formComponents: createFormComponentsSchema,
  gridLayout: createGridLayoutSchema,
  treeStructure: createTreeStructureSchema,
  mixedComplex: createMixedComplexSchema,
  deepNesting: createDeepNestingSchema,
  tableRows: createTableRowsSchema
}

/**
 * 根据场景名称和组件数量创建 Schema
 */
export const createScenarioSchema = (scenario: TestScenario, componentCount: number): Schema => {
  const factory = scenarioFactories[scenario]
  if (!factory) {
    throw new Error(`Unknown scenario: ${scenario}`)
  }
  return factory(componentCount)
}
