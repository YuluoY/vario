/**
 * Schema 验证器增强功能测试
 */

import { describe, it, expect } from 'vitest'
import { 
  validateSchema, 
  validateSchemaWithResult
} from '../src/validator.js'
import { SchemaValidationError } from '../src/schema.types.js'
import type { SchemaNode, ValidationOptions } from '../src/schema.types.js'

describe('Schema 验证器增强', () => {
  describe('递归校验', () => {
    it('应该递归验证嵌套子节点', () => {
      const schema: SchemaNode = {
        type: 'div',
        children: [
          {
            type: 'Button',
            props: { label: 'Click' }
          },
          {
            type: 'Input',
            model: 'user.name'
          }
        ]
      }

      expect(() => validateSchema(schema)).not.toThrow()
    })

    it('应该在嵌套节点错误时报告正确路径', () => {
      const schema = {
        type: 'div',
        children: [
          {
            type: 'Button'
          },
          {
            props: { label: 'Missing type' }
          }
        ]
      }

      expect(() => validateSchema(schema)).toThrow()
      try {
        validateSchema(schema)
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaValidationError)
        expect((error as SchemaValidationError).path).toContain('children[1]')
      }
    })
  })

  describe('表达式校验', () => {
    it('应该验证 props 中的表达式', () => {
      const schema: SchemaNode = {
        type: 'Button',
        props: {
          disabled: '{{ !user.name }}',
          label: '{{ user.name || "Guest" }}'
        }
      }

      expect(() => validateSchema(schema)).not.toThrow()
    })

    it('应该拒绝 props 中的危险表达式', () => {
      const schema = {
        type: 'Button',
        props: {
          onClick: '{{ eval("alert(1)") }}'
        }
      }

      expect(() => validateSchema(schema)).toThrow(SchemaValidationError)
    })

    it('应该验证嵌套对象中的表达式', () => {
      const schema: SchemaNode = {
        type: 'Form',
        props: {
          rules: {
            required: '{{ user.name.length > 0 }}'
          }
        }
      }

      expect(() => validateSchema(schema)).not.toThrow()
    })
  })

  describe('详细错误信息', () => {
    it('应该提供友好的错误消息', () => {
      const schema = {
        type: 'div',
        cond: 'invalid expression ='
      }

      try {
        validateSchema(schema)
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaValidationError)
        const friendly = (error as SchemaValidationError).getFriendlyMessage()
        expect(friendly).toContain('路径')
        expect(friendly).toContain('表达式')
      }
    })

    it('应该提供修复建议', () => {
      const schema = {
        type: 'div',
        props: {
          onClick: '{{ window.alert }}'
        }
      }

      try {
        validateSchema(schema)
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaValidationError)
        const context = (error as SchemaValidationError).context
        expect(context?.suggestion).toBeDefined()
      }
    })
  })

  describe('验证选项', () => {
    it('应该支持跳过表达式验证', () => {
      const schema = {
        type: 'div',
        cond: 'invalid expression ='
      }

      const options: ValidationOptions = {
        validateExpressions: false
      }

      expect(() => validateSchema(schema, options)).not.toThrow()
    })

    it('应该支持跳过路径验证', () => {
      const schema = {
        type: 'Input',
        model: '$invalid.path'
      }

      const options: ValidationOptions = {
        validatePaths: false
      }

      expect(() => validateSchema(schema, options)).not.toThrow()
    })

    it('应该支持自定义验证器', () => {
      const schema: SchemaNode = {
        type: 'CustomComponent',
        props: { customProp: 'value' }
      }

      let customValidatorCalled = false
      const options: ValidationOptions = {
        customValidators: [
          (node, path) => {
            if (node.type === 'CustomComponent') {
              customValidatorCalled = true
            }
          }
        ]
      }

      validateSchema(schema, options)
      expect(customValidatorCalled).toBe(true)
    })
  })

  describe('validateSchemaWithResult', () => {
    it('应该返回验证结果而不是抛出错误', () => {
      const invalidSchema = {
        props: { label: 'Missing type' }
      }

      const result = validateSchemaWithResult(invalidSchema)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toBeInstanceOf(SchemaValidationError)
    })

    it('应该返回空错误数组当验证通过', () => {
      const schema: SchemaNode = {
        type: 'Button',
        props: { label: 'Click' }
      }

      const result = validateSchemaWithResult(schema)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })
  })
})
