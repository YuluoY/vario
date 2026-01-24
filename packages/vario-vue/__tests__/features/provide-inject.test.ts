/**
 * Provide/Inject 功能单元测试
 * 
 * 测试：
 * - setupProvide 设置 provide
 * - setupInject 获取 inject
 * - setupProvideInject 组合使用
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { provide, inject, defineComponent, h } from 'vue'
import { createRuntimeContext } from '@variojs/core'
import { setupProvide, setupInject, setupProvideInject } from '../../src/features/provide-inject.js'
import type { VueSchemaNode } from '../../src/types.js'
import type { RuntimeContext } from '@variojs/core'

// Mock Vue's provide and inject
vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    provide: vi.fn(),
    inject: vi.fn((key: string, defaultValue?: any) => {
      // 模拟 inject 行为
      const mockValues: Record<string, any> = {
        theme: 'dark',
        locale: 'zh-CN'
      }
      return mockValues[key] ?? defaultValue
    })
  }
})

describe('setupProvide', () => {
  let ctx: RuntimeContext

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = createRuntimeContext({
      theme: 'light',
      locale: 'en-US'
    })
  })

  it('应该在没有 provide 时不调用 provide', () => {
    const schema: VueSchemaNode = {
      type: 'div'
    }

    setupProvide(schema, ctx)

    expect(provide).not.toHaveBeenCalled()
  })

  it('应该提供静态值', () => {
    const schema: VueSchemaNode = {
      type: 'div',
      provide: {
        appName: 'MyApp',
        version: '1.0.0'
      }
    }

    setupProvide(schema, ctx)

    expect(provide).toHaveBeenCalledTimes(2)
    expect(provide).toHaveBeenCalledWith('appName', 'MyApp')
    expect(provide).toHaveBeenCalledWith('version', '1.0.0')
  })

  it('应该提供表达式计算后的值', () => {
    const schema: VueSchemaNode = {
      type: 'div',
      provide: {
        currentTheme: 'theme',
        currentLocale: 'locale'
      }
    }

    setupProvide(schema, ctx)

    expect(provide).toHaveBeenCalledTimes(2)
    expect(provide).toHaveBeenCalledWith('currentTheme', 'light')
    expect(provide).toHaveBeenCalledWith('currentLocale', 'en-US')
  })

  it('应该处理非法表达式回退到原始值', () => {
    const schema: VueSchemaNode = {
      type: 'div',
      provide: {
        invalid: '{{ invalid expression }}'
      }
    }

    setupProvide(schema, ctx)

    expect(provide).toHaveBeenCalledWith('invalid', '{{ invalid expression }}')
  })
})

describe('setupInject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该在没有 inject 时返回空对象', () => {
    const schema: VueSchemaNode = {
      type: 'div'
    }

    const result = setupInject(schema)

    expect(result).toEqual({})
  })

  it('应该处理数组形式的 inject', () => {
    const schema: VueSchemaNode = {
      type: 'div',
      inject: ['theme', 'locale']
    }

    const result = setupInject(schema)

    expect(inject).toHaveBeenCalledTimes(2)
    expect(result).toHaveProperty('theme', 'dark')
    expect(result).toHaveProperty('locale', 'zh-CN')
  })

  it('应该处理对象简单映射形式的 inject', () => {
    const schema: VueSchemaNode = {
      type: 'div',
      inject: {
        myTheme: 'theme'
      }
    }

    const result = setupInject(schema)

    expect(result).toHaveProperty('myTheme', 'dark')
  })

  it('应该处理完整配置形式的 inject', () => {
    const schema: VueSchemaNode = {
      type: 'div',
      inject: {
        myTheme: { from: 'theme', default: 'light' }
      }
    }

    const result = setupInject(schema)

    expect(result).toHaveProperty('myTheme')
  })

  it('应该使用默认值当 inject 不存在时', () => {
    const schema: VueSchemaNode = {
      type: 'div',
      inject: {
        unknownKey: { from: 'nonexistent', default: 'fallback' }
      }
    }

    const result = setupInject(schema)

    expect(result).toHaveProperty('unknownKey', 'fallback')
  })
})

describe('setupProvideInject', () => {
  let ctx: RuntimeContext

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = createRuntimeContext({
      appTheme: 'blue'
    })
  })

  it('应该同时处理 provide 和 inject', () => {
    const schema: VueSchemaNode = {
      type: 'div',
      provide: {
        providedTheme: 'appTheme'
      },
      inject: ['theme']
    }

    const result = setupProvideInject(schema, ctx)

    // 验证 provide 被调用
    expect(provide).toHaveBeenCalledWith('providedTheme', 'blue')
    
    // 验证 inject 返回值
    expect(result).toHaveProperty('theme', 'dark')
  })
})
