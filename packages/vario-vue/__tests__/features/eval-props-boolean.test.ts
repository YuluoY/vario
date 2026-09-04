import { describe, expect, it } from 'vitest'
import { createRuntimeContext } from '@variojs/core'
import { ChildrenResolver } from '../../src/features/children-resolver.js'
import { ExpressionEvaluator } from '../../src/features/expression-evaluator.js'

describe('evalProps boolean attrs', () => {
  it('preserves static boolean values instead of stringifying them', () => {
    const resolver = new ChildrenResolver(() => null, new ExpressionEvaluator())
    const ctx = createRuntimeContext({})
    const result = resolver.evalProps({ disabled: true, visible: false, label: 'ok' }, ctx)
    expect(result.disabled).toBe(true)
    expect(result.visible).toBe(false)
    expect(typeof result.disabled).toBe('boolean')
  })

  it('T3.7 named slot functions are rebuilt per resolve（FR-5：移除插槽函数缓存，捕获每帧最新 modelPathStack/parentMap）', () => {
    const resolver = new ChildrenResolver((schema) => ({ type: schema.type }), new ExpressionEvaluator())
    const ctx = createRuntimeContext({})
    const schema = {
      type: 'Panel',
      children: [
        { type: 'template', slot: 'header', children: [{ type: 'span', children: 'H' }] },
        { type: 'span', children: 'body' }
      ]
    }
    const first = resolver.resolveChildren(schema as never, ctx) as Record<string, () => unknown>
    const second = resolver.resolveChildren(schema as never, ctx) as Record<string, () => unknown>
    expect(typeof first.header).toBe('function')
    // 每帧重建插槽函数：不再按 parentSchema 缓存（避免捕获过期的 modelPathStack/parentMap）
    expect(first.header).not.toBe(second.header)
    // 两次解析的插槽内容一致
    const v1 = (first.header as () => unknown[])()
    const v2 = (second.header as () => unknown[])()
    expect(JSON.stringify(v1)).toBe(JSON.stringify(v2))
  })
})
