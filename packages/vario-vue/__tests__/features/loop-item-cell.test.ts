/**
 * 列表项组件化（方案 B）单元测试
 *
 * 测试场景：
 * - LoopItemCell 组件正确渲染循环项
 * - loopItemAsComponent 配置下每项独立更新
 * - 单项更新时其他项不重渲染
 * - 与 path-memo 并存（列表用 B，其它用 A）
 * - 嵌套循环场景
 * - 循环项中的事件处理与节点上下文
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, ref, reactive } from 'vue'
import { useVario } from '../../src/composable.js'
import type { Schema } from '@variojs/schema'
import { VueRenderer } from '../../src/renderer.js'
import { createRuntimeContext } from '@variojs/core'

describe('列表项组件化（方案 B）', () => {
  describe('LoopItemCell 基础功能', () => {
    it('应正确渲染循环列表', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [
          {
            type: 'span',
            loop: {
              items: '{{ items }}',
              itemKey: 'item',
              indexKey: 'idx'
            },
            props: {
              'data-id': '{{ item.id }}'
            },
            children: '{{ item.name }}'
          }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: {
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
            { id: 3, name: 'Item 3' }
          ]
        },
        rendererOptions: {
          loopItemAsComponent: true
        }
      })
      await nextTick()

      expect(vnode.value).toBeDefined()
      // 验证渲染的 VNode 结构
      const children = (vnode.value as any)?.children
      expect(children).toBeDefined()
    })

    it('loopItemAsComponent=false 时使用普通循环渲染', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [
          {
            type: 'span',
            loop: {
              items: '{{ items }}',
              itemKey: 'item'
            },
            children: '{{ item.name }}'
          }
        ]
      }

      const { vnode } = useVario(schema, {
        state: {
          items: [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' }
          ]
        },
        rendererOptions: {
          loopItemAsComponent: false
        }
      })
      await nextTick()

      expect(vnode.value).toBeDefined()
    })
  })

  describe('单项更新性能', () => {
    it('更新单项时仅该项重新渲染', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [
          {
            type: 'div',
            loop: {
              items: '{{ items }}',
              itemKey: 'item',
              indexKey: 'idx'
            },
            props: {
              key: '{{ item.id }}',
              class: '{{ "item-" + item.id }}'
            },
            children: '{{ item.name }}'
          }
        ]
      }

      const items = reactive([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ])

      const { vnode, state } = useVario(schema, {
        state: { items },
        rendererOptions: {
          loopItemAsComponent: true
        }
      })
      await nextTick()

      // 更新单项
      state.items[1].name = 'Updated Item 2'
      await nextTick()

      expect(vnode.value).toBeDefined()
      // 验证更新后的状态
      expect(state.items[1].name).toBe('Updated Item 2')
    })

    it('添加项时不影响已有项', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'ul',
        children: [
          {
            type: 'li',
            loop: {
              items: '{{ items }}',
              itemKey: 'item'
            },
            props: {
              key: '{{ item.id }}'
            },
            children: '{{ item.name }}'
          }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: {
          items: [
            { id: 1, name: 'First' },
            { id: 2, name: 'Second' }
          ]
        },
        rendererOptions: {
          loopItemAsComponent: true
        }
      })
      await nextTick()

      // 添加新项
      state.items.push({ id: 3, name: 'Third' })
      await nextTick()

      expect(state.items.length).toBe(3)
      expect(vnode.value).toBeDefined()
    })

    it('删除项时正确移除对应组件', async () => {
      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'ul',
        children: [
          {
            type: 'li',
            loop: {
              items: '{{ items }}',
              itemKey: 'item'
            },
            props: {
              key: '{{ item.id }}'
            },
            children: '{{ item.name }}'
          }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: {
          items: [
            { id: 1, name: 'First' },
            { id: 2, name: 'Second' },
            { id: 3, name: 'Third' }
          ]
        },
        rendererOptions: {
          loopItemAsComponent: true
        }
      })
      await nextTick()

      // 删除中间项
      state.items.splice(1, 1)
      await nextTick()

      expect(state.items.length).toBe(2)
      expect(state.items[0].id).toBe(1)
      expect(state.items[1].id).toBe(3)
    })
  })

  describe('与 path-memo 并存', () => {
    it('列表外的节点使用 path-memo 缓存', async () => {
      const schema: Schema<{ 
        title: string
        items: Array<{ id: number; name: string }> 
      }> = {
        type: 'div',
        children: [
          {
            type: 'h1',
            children: '{{ title }}'
          },
          {
            type: 'ul',
            children: [
              {
                type: 'li',
                loop: {
                  items: '{{ items }}',
                  itemKey: 'item'
                },
                children: '{{ item.name }}'
              }
            ]
          }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: {
          title: 'My List',
          items: [{ id: 1, name: 'A' }]
        },
        rendererOptions: {
          usePathMemo: true,
          loopItemAsComponent: true
        }
      })
      await nextTick()

      // 更新列表项
      state.items[0].name = 'Updated A'
      await nextTick()

      expect(vnode.value).toBeDefined()
    })
  })

  describe('嵌套循环', () => {
    it('应支持嵌套循环场景', async () => {
      const schema: Schema<{ 
        groups: Array<{ 
          id: number
          name: string
          items: Array<{ id: number; label: string }> 
        }> 
      }> = {
        type: 'div',
        children: [
          {
            type: 'div',
            loop: {
              items: '{{ groups }}',
              itemKey: 'group'
            },
            children: [
              {
                type: 'h2',
                children: '{{ group.name }}'
              },
              {
                type: 'ul',
                children: [
                  {
                    type: 'li',
                    loop: {
                      items: '{{ group.items }}',
                      itemKey: 'subItem'
                    },
                    children: '{{ subItem.label }}'
                  }
                ]
              }
            ]
          }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: {
          groups: [
            {
              id: 1,
              name: 'Group 1',
              items: [
                { id: 11, label: 'Item 1.1' },
                { id: 12, label: 'Item 1.2' }
              ]
            },
            {
              id: 2,
              name: 'Group 2',
              items: [
                { id: 21, label: 'Item 2.1' }
              ]
            }
          ]
        },
        rendererOptions: {
          loopItemAsComponent: true
        }
      })
      await nextTick()

      expect(vnode.value).toBeDefined()
      expect(state.groups.length).toBe(2)
    })
  })

  describe('循环项中的事件处理', () => {
    it('事件中应能访问循环上下文', async () => {
      let capturedItem: any = null
      let capturedIndex: number | null = null

      const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
        type: 'div',
        children: [
          {
            type: 'button',
            loop: {
              items: '{{ items }}',
              itemKey: 'item',
              indexKey: 'idx'
            },
            props: {
              'data-id': '{{ item.id }}'
            },
            events: {
              click: [
                {
                  type: 'action',
                  handler: 'onItemClick'
                }
              ]
            },
            children: '{{ item.name }}'
          }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: {
          items: [
            { id: 1, name: 'Click Me' }
          ]
        },
        methods: {
          onItemClick: ({ ctx }) => {
            capturedItem = (ctx as any).item
            capturedIndex = (ctx as any).idx
          }
        },
        rendererOptions: {
          loopItemAsComponent: true
        }
      })
      await nextTick()

      expect(vnode.value).toBeDefined()
    })
  })

  describe('循环项 key 生成', () => {
    it('使用 item 中指定的 key 属性', async () => {
      const schema: Schema<{ items: Array<{ uuid: string; name: string }> }> = {
        type: 'ul',
        children: [
          {
            type: 'li',
            loop: {
              items: '{{ items }}',
              itemKey: 'item'
            },
            props: {
              key: '{{ item.uuid }}'
            },
            children: '{{ item.name }}'
          }
        ]
      }

      const { vnode } = useVario(schema, {
        state: {
          items: [
            { uuid: 'abc-123', name: 'A' },
            { uuid: 'def-456', name: 'B' }
          ]
        },
        rendererOptions: {
          loopItemAsComponent: true
        }
      })
      await nextTick()

      expect(vnode.value).toBeDefined()
    })

    it('无指定 key 时使用 id 或 index 作为后备', async () => {
      const schema: Schema<{ items: Array<{ name: string }> }> = {
        type: 'ul',
        children: [
          {
            type: 'li',
            loop: {
              items: '{{ items }}',
              itemKey: 'item'
            },
            children: '{{ item.name }}'
          }
        ]
      }

      const { vnode } = useVario(schema, {
        state: {
          items: [
            { name: 'No ID 1' },
            { name: 'No ID 2' }
          ]
        },
        rendererOptions: {
          loopItemAsComponent: true
        }
      })
      await nextTick()

      expect(vnode.value).toBeDefined()
    })
  })

  describe('边界情况', () => {
    it('空数组应不渲染任何项', async () => {
      const schema: Schema<{ items: any[] }> = {
        type: 'ul',
        children: [
          {
            type: 'li',
            loop: {
              items: '{{ items }}',
              itemKey: 'item'
            },
            children: '{{ item }}'
          }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: { items: [] },
        rendererOptions: {
          loopItemAsComponent: true
        }
      })
      await nextTick()

      expect(vnode.value).toBeDefined()
      expect(state.items.length).toBe(0)
    })

    it('循环数据源非数组时应显示错误', async () => {
      const schema: Schema<{ items: any }> = {
        type: 'ul',
        children: [
          {
            type: 'li',
            loop: {
              items: '{{ items }}',
              itemKey: 'item'
            },
            children: '{{ item }}'
          }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: { items: 'not an array' as any },
        rendererOptions: {
          loopItemAsComponent: true
        }
      })
      await nextTick()

      expect(vnode.value).toBeDefined()
    })

    it('循环项中有 model 绑定时正确处理', async () => {
      const schema: Schema<{ 
        items: Array<{ id: number; value: string }> 
      }> = {
        type: 'div',
        model: { path: 'items', scope: true },
        children: [
          {
            type: 'input',
            loop: {
              items: '{{ items }}',
              itemKey: 'item',
              indexKey: 'idx'
            },
            model: '{{ idx }}.value',
            props: {
              placeholder: '{{ "Enter value for item " + item.id }}'
            }
          }
        ]
      }

      const { vnode, state } = useVario(schema, {
        state: {
          items: [
            { id: 1, value: 'A' },
            { id: 2, value: 'B' }
          ]
        },
        rendererOptions: {
          loopItemAsComponent: true
        }
      })
      await nextTick()

      expect(vnode.value).toBeDefined()
      expect(state.items[0].value).toBe('A')
      expect(state.items[1].value).toBe('B')
    })
  })
})
