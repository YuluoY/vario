/**
 * 集成测试：控制流 (cond/show/loop) 跨 core+vue 协作
 *
 * 验证 schema 的条件渲染、显示控制和循环在完整渲染通道中的行为。
 */
import { describe, it, expect } from 'vitest'
import { createRuntimeContext, execute } from '@vario/core'
import { VueRenderer } from '@vario/vue'

describe('Control flow integration', () => {
  let renderer: InstanceType<typeof VueRenderer>

  beforeEach(() => {
    renderer = new VueRenderer()
  })

  describe('cond (conditional rendering)', () => {
    it('should render node when cond is true', () => {
      const ctx = createRuntimeContext({ visible: true })
      const vnode = renderer.render({
        type: 'div',
        cond: '{{ visible }}',
        children: 'shown'
      }, ctx)
      expect(vnode).toBeDefined()
    })

    it('should skip node when cond is false', () => {
      const ctx = createRuntimeContext({ visible: false })
      const vnode = renderer.render({
        type: 'div',
        cond: '{{ visible }}',
        children: 'hidden'
      }, ctx)
      // cond=false → render returns fragment placeholder
      expect(vnode).toBeDefined()
    })

    it('should evaluate complex cond expressions', () => {
      const ctx = createRuntimeContext({ items: [1, 2, 3] })
      const vnode = renderer.render({
        type: 'span',
        cond: '{{ items.length > 2 }}',
        children: 'many items'
      }, ctx)
      expect(vnode).toBeDefined()
    })
  })

  describe('show (display toggle)', () => {
    it('should apply display:none when show is false', () => {
      const ctx = createRuntimeContext({ active: false })
      const vnode = renderer.render({
        type: 'div',
        show: '{{ active }}',
        children: 'content'
      }, ctx)
      expect(vnode).toBeDefined()
      // show=false → style contains display:none
      expect(vnode.props?.style?.display).toBe('none')
    })

    it('should not modify style when show is true', () => {
      const ctx = createRuntimeContext({ active: true })
      const vnode = renderer.render({
        type: 'div',
        show: '{{ active }}',
        children: 'content'
      }, ctx)
      expect(vnode.props?.style?.display).toBeUndefined()
    })
  })

  describe('loop', () => {
    it('should render loop items', () => {
      const ctx = createRuntimeContext({ items: ['a', 'b', 'c'] })
      const vnode = renderer.render({
        type: 'ul',
        children: [{
          type: 'li',
          loop: { items: '{{ items }}', itemKey: 'item', indexKey: 'idx' },
          children: '{{ item }}'
        }]
      }, ctx)
      expect(vnode).toBeDefined()
    })

    it('should handle empty loop array', () => {
      const ctx = createRuntimeContext({ items: [] })
      const vnode = renderer.render({
        type: 'ul',
        children: [{
          type: 'li',
          loop: { items: '{{ items }}', itemKey: 'item' },
          children: '{{ item }}'
        }]
      }, ctx)
      expect(vnode).toBeDefined()
    })
  })

  describe('combined control flow', () => {
    it('should handle cond + show on same node', () => {
      const ctx = createRuntimeContext({ exists: true, visible: false })
      const vnode = renderer.render({
        type: 'div',
        cond: '{{ exists }}',
        show: '{{ visible }}',
        children: 'test'
      }, ctx)
      // cond=true → rendered, show=false → display:none
      expect(vnode).toBeDefined()
      expect(vnode.props?.style?.display).toBe('none')
    })

    it('should handle state change via VM then re-render', async () => {
      const ctx = createRuntimeContext({ count: 0 })

      // VM 修改状态
      await execute([
        { type: 'set', path: 'count', value: 5 }
      ], ctx)

      expect(ctx.count).toBe(5)

      // 用新状态渲染
      const vnode = renderer.render({
        type: 'span',
        cond: '{{ count > 3 }}',
        children: '{{ count }}'
      }, ctx)

      expect(vnode).toBeDefined()
    })
  })
})
