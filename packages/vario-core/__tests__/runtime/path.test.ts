import { describe, it, expect } from 'vitest'
import { parsePath, setPathValue, getPathValue } from '../../src/runtime/path'

describe('parsePath', () => {
  describe('基础语法', () => {
    it('应该解析点语法路径', () => {
      expect(parsePath('user.name')).toEqual(['user', 'name'])
      expect(parsePath('a.b.c')).toEqual(['a', 'b', 'c'])
    })

    it('应该将纯数字段解析为数字', () => {
      expect(parsePath('items.0.text')).toEqual(['items', 0, 'text'])
      expect(parsePath('users.1.name')).toEqual(['users', 1, 'name'])
    })

    it('应该处理空路径', () => {
      expect(parsePath('')).toEqual([])
      expect(parsePath(null as any)).toEqual([])
      expect(parsePath(undefined as any)).toEqual([])
    })
  })

  describe('[] 语法', () => {
    it('应该解析数字索引', () => {
      expect(parsePath('users[0].name')).toEqual(['users', 0, 'name'])
      expect(parsePath('items[1]')).toEqual(['items', 1])
      expect(parsePath('data[10].value')).toEqual(['data', 10, 'value'])
    })

    it('应该解析空括号为动态索引 (-1)', () => {
      expect(parsePath('users[].name')).toEqual(['users', -1, 'name'])
      expect(parsePath('items[]')).toEqual(['items', -1])
    })

    it('应该解析字符串键', () => {
      expect(parsePath('obj[key].value')).toEqual(['obj', 'key', 'value'])
    })

    it('应该处理多个括号', () => {
      expect(parsePath('matrix[0][1]')).toEqual(['matrix', 0, 1])
      expect(parsePath('data[0].items[1].name')).toEqual(['data', 0, 'items', 1, 'name'])
    })

    it('应该处理混合语法', () => {
      expect(parsePath('users[0].profile.tags[1]')).toEqual(['users', 0, 'profile', 'tags', 1])
      expect(parsePath('data.users[0].name')).toEqual(['data', 'users', 0, 'name'])
    })

    it('应该处理连续括号和点', () => {
      expect(parsePath('[0].name')).toEqual([0, 'name'])
      expect(parsePath('users[0][1]')).toEqual(['users', 0, 1])
    })
  })
})

describe('setPathValue 与 [] 语法', () => {
  it('应该根据数字索引创建数组', () => {
    const obj: Record<string, unknown> = {}
    setPathValue(obj, 'users[0].name', 'John')
    
    expect(Array.isArray(obj.users)).toBe(true)
    expect((obj.users as any)[0].name).toBe('John')
  })

  it('应该根据字符串键创建对象', () => {
    const obj: Record<string, unknown> = {}
    setPathValue(obj, 'data.user.name', 'John')
    
    expect(typeof obj.data).toBe('object')
    expect((obj.data as any).user.name).toBe('John')
  })

  it('应该处理嵌套数组', () => {
    const obj: Record<string, unknown> = {}
    setPathValue(obj, 'matrix[0][1]', 'value')
    
    expect(Array.isArray(obj.matrix)).toBe(true)
    expect(Array.isArray((obj.matrix as any)[0])).toBe(true)
    expect((obj.matrix as any)[0][1]).toBe('value')
  })

  it('应该处理混合嵌套', () => {
    const obj: Record<string, unknown> = {}
    setPathValue(obj, 'data.users[0].profile.tags[1]', 'tag1')
    
    expect(typeof obj.data).toBe('object')
    expect(Array.isArray((obj.data as any).users)).toBe(true)
    expect(typeof (obj.data as any).users[0].profile).toBe('object')
    expect(Array.isArray((obj.data as any).users[0].profile.tags)).toBe(true)
    expect((obj.data as any).users[0].profile.tags[1]).toBe('tag1')
  })
})

describe('getPathValue 与 [] 语法', () => {
  it('应该获取数组索引的值', () => {
    const obj = {
      users: [
        { name: 'John' },
        { name: 'Jane' }
      ]
    }
    
    expect(getPathValue(obj, 'users[0].name')).toBe('John')
    expect(getPathValue(obj, 'users[1].name')).toBe('Jane')
  })

  it('应该获取嵌套数组的值', () => {
    const obj = {
      matrix: [[1, 2], [3, 4]]
    }
    
    expect(getPathValue(obj, 'matrix[0][0]')).toBe(1)
    expect(getPathValue(obj, 'matrix[1][1]')).toBe(4)
  })

  it('应该处理混合路径', () => {
    const obj = {
      data: {
        users: [
          { profile: { tags: ['a', 'b'] } }
        ]
      }
    }
    
    expect(getPathValue(obj, 'data.users[0].profile.tags[0]')).toBe('a')
    expect(getPathValue(obj, 'data.users[0].profile.tags[1]')).toBe('b')
  })
})
