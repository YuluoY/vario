import { describe, expect, it } from 'vitest'
import type { Action, EventHandler } from '@variojs/types'
import { normalizeEventHandler } from '../src/event-handler.js'
import { validateActionPayload } from '../src/action-contract.js'
import { SchemaValidationError } from '../src/schema.types.js'
import { validateSchema, validateSchemaWithResult } from '../src/validator.js'

const expectedCall: Action = { type: 'call', method: 'submit' }

describe('CONTRACT-1/3/5 EventHandler matrix', () => {
  const forms: Array<[string, EventHandler]> = [
    ['action object', { type: 'call', method: 'submit' }],
    ['action array', [{ type: 'call', method: 'submit' }]],
    ['method string', 'submit'],
    ['method string array', ['submit']],
    ['call shorthand', ['call', 'submit']],
  ]

  it.each(forms)('%s normalizes to the same ActionPlan', (_label, handler) => {
    expect(normalizeEventHandler(handler)).toEqual([expectedCall])
  })

  it('call shorthand keeps params and modifiers', () => {
    expect(normalizeEventHandler(['call', 'submit', ['{{ id }}'], ['stop']])).toEqual([
      { type: 'call', method: 'submit', params: ['{{ id }}'], modifiers: ['stop'] }
    ])
  })

  it('five forms pass schema validation', () => {
    for (const [, handler] of forms) {
      expect(() => validateSchema({
        type: 'Button',
        events: { click: handler }
      })).not.toThrow()
    }
  })
})

describe('CONTRACT-3 builtin action payload', () => {
  const valid: Action[] = [
    { type: 'set', path: 'count', value: 1 },
    { type: 'emit', event: 'done' },
    { type: 'navigate', to: '/home' },
    { type: 'log', message: 'ok' },
    { type: 'if', cond: 'ok' },
    { type: 'loop', var: 'item', in: 'items', body: [{ type: 'log', message: 'x' }] },
    { type: 'call', method: 'save' },
    { type: 'batch', actions: [{ type: 'set', path: 'a', value: 1 }] },
    { type: 'push', path: 'items', value: 1 },
    { type: 'pop', path: 'items' },
    { type: 'shift', path: 'items' },
    { type: 'unshift', path: 'items', value: 1 },
    { type: 'splice', path: 'items', start: 0 },
  ]

  it('accepts each builtin legal payload', () => {
    for (const action of valid) {
      expect(validateActionPayload(action)).toBeNull()
    }
  })

  it('rejects missing params, wrong types, and unknown type', () => {
    expect(validateActionPayload({ type: 'set', path: 'x' } as Action)?.code).toBe('ACTION_MISSING_PARAM')
    expect(validateActionPayload({ type: 'set', path: 1, value: 1 } as unknown as Action)?.code).toBe('ACTION_MISSING_PARAM')
    expect(validateActionPayload({ type: 'emit' } as Action)?.code).toBe('ACTION_MISSING_PARAM')
    expect(validateActionPayload({ type: 'unknown' })?.code).toBe('UNKNOWN_ACTION_TYPE')
  })

  it('fuzz rejects unknown action types and prototype-like event keys', () => {
    for (let i = 0; i < 40; i++) {
      expect(validateActionPayload({ type: `fuzz${i}` })?.code).toBe('UNKNOWN_ACTION_TYPE')
    }
    expect(() => validateSchema({
      type: 'Button',
      events: { click: [{ type: '__proto__' }] }
    })).toThrow()
  })

  it('validator rejects unknown action type', () => {
    expect(() => validateSchema({
      type: 'Button',
      events: { click: [{ type: 'hack', path: 'x' }] }
    })).toThrow(SchemaValidationError)
  })
})

describe('CONTRACT-4 duplicate id / root id', () => {
  it('blocks duplicate node ids', () => {
    expect(() => validateSchema({
      type: 'div',
      id: 'root',
      children: [
        { type: 'span', id: 'dup' },
        { type: 'span', id: 'dup' }
      ]
    })).toThrow(/Duplicate node id/)
  })

  it('allows unique ids including root', () => {
    expect(() => validateSchema({
      type: 'div',
      id: 'root',
      children: [{ type: 'span', id: 'child' }]
    })).not.toThrow()
  })

  it('emits schema-validate through DiagnosticSink', () => {
    const names: string[] = []
    const result = validateSchemaWithResult({ type: 'div' }, {
      diagnosticSink: { emit(event) { names.push(event.name) } }
    })
    expect(result.valid).toBe(true)
    expect(names).toContain('schema-validate')
  })
})

import { prepareView } from '../src/compiler/prepare-view.js'
import { traverseIterative } from '../src/compiler/traverse-iterative.js'

describe('T1 prepareView', () => {
  it('builds index with root first-match and region classification', () => {
    const view = prepareView({
      type: 'div',
      id: 'root',
      children: [
        { type: 'span', id: 'a', children: '{{ label }}' },
        { type: 'div', loop: { items: 'items', itemKey: 'item' }, children: [{ type: 'i' }] }
      ]
    } as never)
    expect(view.idMap.get('root')).toBe('')
    expect(view.nodes.get('root')?.id).toBe('root')
    expect(view.nodeCount).toBe(4)
    expect([...view.regions.values()].find(r => r.kind === 'loop')?.nodeIds.length).toBe(1)
  })

  it('traverseIterative visits 10000-deep chain', () => {
    let node: { type: string; children?: unknown[] } = { type: 'leaf' }
    for (let i = 0; i < 9999; i++) node = { type: 'div', children: [node] }
    const stats = traverseIterative(node as never, () => {})
    expect(stats.maxDepth).toBe(10000)
  })

  it('compiles expressions and loop plans without publishing a partial view', () => {
    const view = prepareView({
      type: 'div',
      id: 'root',
      children: [
        { type: 'span', id: 'a', children: '{{ label }}' },
        { type: 'div', loop: { items: 'items', itemKey: 'item' }, children: [{ type: 'i' }] }
      ]
    } as never)
    expect(view.expressions.size).toBeGreaterThan(0)
    expect(view.loops.size).toBe(1)
    expect(view.slots.size).toBe(0)
  })

  it('rejects unsupported event modifiers at compile', () => {
    expect(() => prepareView({
      type: 'button',
      events: { 'click.not-a-mod': 'go' }
    } as never)).toThrow(/Unsupported event modifier/)
  })
})

import { serializeSchema, parseSchema } from '../src/codec/index.js'
import { migrateToV1, rollbackToV0, migrateIdempotent, describeDocument, wrapLegacy } from '../src/migrations/index.js'
import { validateMaterialManifest } from '../src/material-manifest.js'
import { normalizeSchema } from '../src/normalizer.js'

describe('CONTRACT-5/7 codec migrate', () => {
  it('serialize parse migrate normalize is idempotent and rollbackable', () => {
    const root = { type: 'div', id: 'r', children: 'hi' }
    const raw = serializeSchema(root as never)
    const parsed = parseSchema(raw)
    const v1 = migrateToV1(parsed)
    const again = migrateIdempotent(v1)
    expect(again).toEqual(v1)
    const rolled = rollbackToV0(v1)
    expect(rolled.version).toBe(0)
    expect(normalizeSchema(v1.root as never)).toEqual(normalizeSchema(migrateToV1(rolled).root as never))
  })

  it('COMP-4 wrapLegacy accepts a bare SchemaNode as v0', () => {
    const wrapped = wrapLegacy({ type: 'span', children: 'n' })
    expect(wrapped.version).toBe(1)
    expect(wrapped.schemaVersion).toBe(1)
    expect(wrapped.id).toBe('doc:root')
    expect(wrapped.root.type).toBe('span')
    expect(migrateIdempotent(wrapped)).toEqual(wrapped)
    const withMaterials = migrateToV1({
      version: 0,
      root: { type: 'div' },
      materials: [{ name: 'Button', type: 'Button', version: '2.1.0' }]
    })
    expect(withMaterials.materialVersions).toEqual({ Button: '2.1.0' })
    const names: string[] = []
    wrapLegacy({ type: 'div' }, { diagnosticSink: { emit(event) { names.push(event.name) } } })
    expect(names).toContain('schema-migrate')
    const loaded: string[] = []
    parseSchema(JSON.stringify({ version: 1, root: { type: 'div' } }), {
      diagnosticSink: { emit(event) { loaded.push(event.name) } }
    })
    expect(loaded).toContain('schema-load')
  })

  it('CONTRACT-5 serialize parse migrate normalize prepare golden', () => {
    const root = { type: 'div', id: 'r', children: '{{ t }}' }
    const raw = serializeSchema(root as never)
    const parsed = parseSchema(raw)
    const v1 = migrateToV1(parsed)
    const normalized = normalizeSchema(v1.root as never)
    const view = prepareView(normalized, { revision: 1 })
    expect([...view.nodes.values()].map(n => n.type)).toEqual(['div'])
    expect(view.expressions.size).toBeGreaterThan(0)
    expect(describeDocument(v1).metadata).toMatchObject({ version: 1 })
  })

  it('v1 codec omits function and RegExp from the persisted document', () => {
    const raw = serializeSchema({
      type: 'div',
      props: { ok: 'x', fn: () => 1, pattern: /a/ }
    } as never)
    expect(raw).not.toContain('function')
    const parsed = JSON.parse(raw) as { version: number; root: { props: Record<string, unknown> } }
    expect(parsed.version).toBe(1)
    expect(parsed.root.props.ok).toBe('x')
    expect(parsed.root.props.fn).toBeUndefined()
    expect(parsed.root.props.pattern).toBeUndefined()
  })
})

describe('CONTRACT-6 MaterialManifest', () => {
  it('accepts valid and rejects invalid manifests', () => {
    expect(validateMaterialManifest({
      name: 'card',
      version: '1.0.0',
      props: { title: 'string' },
      events: ['click'],
      slots: ['default'],
      models: ['value'],
      capabilities: []
    }).valid).toBe(true)
    expect(validateMaterialManifest({ name: 'x' }).valid).toBe(false)
    expect(validateMaterialManifest({
      type: 'card',
      version: '1.0.0',
      props: { type: 'object' },
      events: { click: { payload: 'void' } },
      slots: { default: {} },
      models: { value: {} }
    }).valid).toBe(true)
  })
})

import { compileLoopPlan } from '../src/compiler/prepare-loop.js'
import { compileSlotPlan } from '../src/compiler/prepare-slot.js'

describe('T3.3 LoopPlan/SlotPlan', () => {
  it('freezes loop and slot plans', () => {
    const loop = compileLoopPlan({
      type: 'div',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' }
    } as never, 'n1', ['child'])
    const slot = compileSlotPlan({ type: 'template', slot: 'default' } as never, 'n2', [])
    expect(Object.isFrozen(loop)).toBe(true)
    expect(Object.isFrozen(slot)).toBe(true)
    expect(loop?.itemKey).toBe('item')
    expect(slot?.name).toBe('default')
  })
})
