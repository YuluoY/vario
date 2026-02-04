/**
 * 事件修饰符测试
 * 
 * 测试场景：
 * 1. .stop 修饰符 - 阻止冒泡
 * 2. .prevent 修饰符 - 阻止默认行为
 * 3. .self 修饰符 - 只在自身触发
 * 4. .once 修饰符 - 只触发一次
 * 5. 组合修饰符
 * 6. 数组简写格式修饰符 [type, method, args, modifiers]
 */

import { describe, it, expect, vi } from 'vitest'
import { createRuntimeContext } from '@variojs/core'
import { EventHandler } from '../src/features/event-handler.js'
import type { SchemaNode } from '@variojs/schema'

describe('事件修饰符', () => {
  const evaluateExpr = (expr: string, ctx: any) => {
    return eval(`with(ctx) { ${expr} }`)
  }

  describe('.stop 修饰符', () => {
    it('应该阻止事件冒泡（事件名修饰符）', () => {
      const clicked = vi.fn()
      
      const schema: SchemaNode = {
        type: 'button',
        events: {
          'click.stop': [{ type: 'call', method: 'onClick' }]
        }
      }

      const runtime = createRuntimeContext({}, {
        methods: {
          onClick: clicked
        }
      })

      const eventHandler = new EventHandler(evaluateExpr)
      const handlers = eventHandler.getEventHandlers(schema, runtime, null as any)

      const event = new Event('click', { bubbles: true })
      const stopPropagation = vi.spyOn(event, 'stopPropagation')
      
      handlers.onClick(event)

      expect(stopPropagation).toHaveBeenCalled()
      expect(clicked).toHaveBeenCalled()
    })

    it('应该阻止事件冒泡（数组简写修饰符）', () => {
      const clicked = vi.fn()
      
      const schema: SchemaNode = {
        type: 'button',
        events: {
          click: ['call', 'onClick', [], ['stop']]
        }
      }

      const runtime = createRuntimeContext({}, {
        methods: {
          onClick: clicked
        }
      })
      
      const eventHandler = new EventHandler(evaluateExpr)
      const handlers = eventHandler.getEventHandlers(schema, runtime, null as any)

      const event = new Event('click')
      const stopPropagation = vi.spyOn(event, 'stopPropagation')
      
      handlers.onClick(event)

      expect(stopPropagation).toHaveBeenCalled()
      expect(clicked).toHaveBeenCalled()
    })

    it('应该支持对象形式的修饰符', () => {
      const clicked = vi.fn()
      
      const schema: SchemaNode = {
        type: 'button',
        events: {
          click: ['call', 'onClick', [], { stop: true }]
        }
      }

      const runtime = createRuntimeContext({}, {
        methods: {
          onClick: clicked
        }
      })
      
      const eventHandler = new EventHandler(evaluateExpr)
      const handlers = eventHandler.getEventHandlers(schema, runtime, null as any)

      const event = new Event('click')
      const stopPropagation = vi.spyOn(event, 'stopPropagation')
      
      handlers.onClick(event)

      expect(stopPropagation).toHaveBeenCalled()
      expect(clicked).toHaveBeenCalled()
    })
  })

  describe('.prevent 修饰符', () => {
    it('应该阻止默认行为', () => {
      const submitted = vi.fn()
      
      const schema: SchemaNode = {
        type: 'form',
        events: {
          'submit.prevent': [{ type: 'call', method: 'onSubmit' }]
        }
      }

      const runtime = createRuntimeContext({}, {
        methods: {
          onSubmit: submitted
        }
      })
      
      const eventHandler = new EventHandler(evaluateExpr)
      const handlers = eventHandler.getEventHandlers(schema, runtime, null as any)

      const event = new Event('submit')
      const preventDefault = vi.spyOn(event, 'preventDefault')
      
      handlers.onSubmit(event)

      expect(preventDefault).toHaveBeenCalled()
      expect(submitted).toHaveBeenCalled()
    })
  })

  describe('.once 修饰符', () => {
    it('应该只触发一次', () => {
      const clicked = vi.fn()
      
      const schema: SchemaNode = {
        type: 'button',
        events: {
          'click.once': [{ type: 'call', method: 'onClick' }]
        }
      }

      const runtime = createRuntimeContext({}, {
        methods: {
          onClick: clicked
        }
      })
      
      const eventHandler = new EventHandler(evaluateExpr)
      const handlers = eventHandler.getEventHandlers(schema, runtime, null as any)

      const event = new Event('click')
      
      // 第一次调用
      handlers.onClick(event)
      expect(clicked).toHaveBeenCalledTimes(1)

      // 第二次调用
      handlers.onClick(event)
      expect(clicked).toHaveBeenCalledTimes(1)

      // 第三次调用
      handlers.onClick(event)
      expect(clicked).toHaveBeenCalledTimes(1)
    })
  })

  describe('组合修饰符', () => {
    it('应该同时应用 stop 和 prevent（事件名修饰符）', () => {
      const clicked = vi.fn()
      
      const schema: SchemaNode = {
        type: 'button',
        events: {
          'click.stop.prevent': [{ type: 'call', method: 'onClick' }]
        }
      }

      const runtime = createRuntimeContext({}, {
        methods: {
          onClick: clicked
        }
      })
      
      const eventHandler = new EventHandler(evaluateExpr)
      const handlers = eventHandler.getEventHandlers(schema, runtime, null as any)

      const event = new Event('click', { bubbles: true })
      const stopPropagation = vi.spyOn(event, 'stopPropagation')
      const preventDefault = vi.spyOn(event, 'preventDefault')
      
      handlers.onClick(event)

      expect(stopPropagation).toHaveBeenCalled()
      expect(preventDefault).toHaveBeenCalled()
      expect(clicked).toHaveBeenCalled()
    })
  })

  describe('.capture 和 .passive 修饰符', () => {
    it('应该在处理器上添加元数据标记', () => {
      const clicked = vi.fn()
      
      const schema: SchemaNode = {
        type: 'div',
        events: {
          'scroll.passive': [{ type: 'call', method: 'onScroll' }]
        }
      }

      const runtime = createRuntimeContext({}, {
        methods: {
          onScroll: clicked
        }
      })
      
      const eventHandler = new EventHandler(evaluateExpr)
      const handlers = eventHandler.getEventHandlers(schema, runtime, null as any)

      expect((handlers.onScroll as any).__modifiers).toEqual({ capture: false, passive: true })
    })

    it('应该同时标记 capture 和 passive', () => {
      const clicked = vi.fn()
      
      const schema: SchemaNode = {
        type: 'div',
        events: {
          'scroll.capture.passive': [{ type: 'call', method: 'onScroll' }]
        }
      }

      const runtime = createRuntimeContext({}, {
        methods: {
          onScroll: clicked
        }
      })
      
      const eventHandler = new EventHandler(evaluateExpr)
      const handlers = eventHandler.getEventHandlers(schema, runtime, null as any)

      expect((handlers.onScroll as any).__modifiers).toEqual({ 
        capture: true, 
        passive: true 
      })
    })
  })
})
