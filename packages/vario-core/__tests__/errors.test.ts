/**
 * 错误处理体系测试
 */

import { describe, it, expect } from 'vitest'
import {
  VarioError,
  ActionError,
  ExpressionError,
  ServiceError,
  BatchError,
  ErrorCodes
} from '../src/errors.js'
import type { Action } from '../src/types.js'

describe('错误处理体系', () => {
  describe('VarioError', () => {
    it('应该创建基础错误', () => {
      const error = new VarioError('Test error', 'TEST_ERROR', {
        metadata: { key: 'value' }
      })
      
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_ERROR')
      expect(error.context.metadata).toEqual({ key: 'value' })
      expect(error.name).toBe('VarioError')
    })

    it('应该生成友好的错误消息', () => {
      const error = new VarioError('Test error', 'TEST_ERROR', {
        schemaPath: 'events.click[0]',
        expression: 'user.name',
        action: { type: 'set' } as Action
      })
      
      const friendly = error.getFriendlyMessage()
      expect(friendly).toContain('Test error')
      expect(friendly).toContain('Schema 路径: events.click[0]')
      expect(friendly).toContain('表达式: user.name')
      expect(friendly).toContain('动作类型: set')
    })

    it('应该转换为 JSON', () => {
      const error = new VarioError('Test error', 'TEST_ERROR', {
        metadata: { key: 'value' }
      })
      
      const json = error.toJSON()
      expect(json.name).toBe('VarioError')
      expect(json.message).toBe('Test error')
      expect(json.code).toBe('TEST_ERROR')
      expect(json.context).toBeDefined()
    })
  })

  describe('ActionError', () => {
    it('应该创建动作错误', () => {
      const action: Action = { type: 'set', path: 'count' }
      const error = new ActionError(
        action,
        'Action failed',
        ErrorCodes.ACTION_EXECUTION_ERROR,
        { metadata: { param: 'path' } }
      )
      
      expect(error.message).toBe('Action failed')
      expect(error.code).toBe(ErrorCodes.ACTION_EXECUTION_ERROR)
      expect(error.context.action).toBe(action)
      expect(error.context.metadata).toEqual({ param: 'path' })
    })
  })

  describe('ExpressionError', () => {
    it('应该创建表达式错误', () => {
      const error = new ExpressionError(
        'user.name',
        'Expression failed',
        ErrorCodes.EXPRESSION_EVALUATION_ERROR,
        { metadata: { nodeType: 'Identifier' } }
      )
      
      expect(error.message).toBe('Expression failed')
      expect(error.code).toBe(ErrorCodes.EXPRESSION_EVALUATION_ERROR)
      expect(error.context.expression).toBe('user.name')
      expect(error.context.metadata).toEqual({ nodeType: 'Identifier' })
    })
  })

  describe('ServiceError', () => {
    it('应该创建服务错误', () => {
      const originalError = new Error('Original error')
      const error = new ServiceError(
        'test.service',
        'Service call failed',
        originalError,
        { metadata: { method: 'test.service' } }
      )
      
      expect(error.service).toBe('test.service')
      expect(error.message).toBe('Service call failed')
      expect(error.originalError).toBe(originalError)
      expect(error.context.metadata).toEqual({ method: 'test.service' })
    })
  })

  describe('BatchError', () => {
    it('应该创建批量错误', () => {
      const action1: Action = { type: 'set', path: 'a' }
      const action2: Action = { type: 'set', path: 'b' }
      const error1 = new Error('Error 1')
      const error2 = new Error('Error 2')
      
      const error = new BatchError(
        [
          { action: action1, error: error1 },
          { action: action2, error: error2 }
        ],
        'Batch failed',
        { metadata: { failedCount: 2 } }
      )
      
      expect(error.message).toBe('Batch failed')
      expect(error.failedActions).toHaveLength(2)
      expect(error.failedActions[0].action).toBe(action1)
      expect(error.failedActions[1].action).toBe(action2)
    })
  })

  describe('ErrorCodes', () => {
    it('应该包含所有错误码', () => {
      expect(ErrorCodes.ACTION_UNKNOWN_TYPE).toBe('ACTION_UNKNOWN_TYPE')
      expect(ErrorCodes.ACTION_EXECUTION_ERROR).toBe('ACTION_EXECUTION_ERROR')
      expect(ErrorCodes.EXPRESSION_PARSE_ERROR).toBe('EXPRESSION_PARSE_ERROR')
      expect(ErrorCodes.EXPRESSION_VALIDATION_ERROR).toBe('EXPRESSION_VALIDATION_ERROR')
      expect(ErrorCodes.SERVICE_NOT_FOUND).toBe('SERVICE_NOT_FOUND')
      expect(ErrorCodes.BATCH_ERROR).toBe('BATCH_ERROR')
    })
  })
})
