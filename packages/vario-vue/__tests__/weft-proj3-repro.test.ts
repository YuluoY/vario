/**
 * 临时复现：weft PROJ3 真实 schema 走 adaptLegacySchema + useVario 挂载。
 * 消费 /tmp/proj3-schema.json（由 logic 渲染管线导出）。
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { adaptLegacySchema } from '../src/runtime/legacy-prepared-adapter.js'
import { useVario } from '../src/composable.js'
import type { Schema, SchemaNode } from '@variojs/schema'

const schemaJson = JSON.parse(
  readFileSync('/tmp/proj3-schema.json', 'utf-8')
) as SchemaNode

describe('weft PROJ3 schema repro', () => {
  it('adaptLegacySchema 不抛错', () => {
    const view = adaptLegacySchema(schemaJson as never)
    expect(view).toBeDefined()
  })

  it('useVario 挂载 vnode 非空', () => {
    const { vnode } = useVario(() => schemaJson as Schema)
    expect(vnode.value).not.toBeNull()
  })
})
