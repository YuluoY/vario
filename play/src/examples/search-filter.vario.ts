/**
 * 搜索过滤示例 - 展示列表搜索和过滤功能
 */

import { useVario } from '@vario/vue'
import type { Schema } from '@vario/schema'
import type { App } from 'vue'

interface ItemType {
  id: number
  name: string
  category: string
  price: number
  tags: string[]
}

interface SearchFilterState extends Record<string, unknown> {
  items: ItemType[]
  searchQuery: string
  selectedCategory: string
  filteredItems?: ItemType[]  // computed 属性，可选
}

export function createSearchFilter(app?: App | null) {
  const searchFilterSchema: Schema<SearchFilterState> = {
    type: 'div',
    props: {
      class: 'search-filter-demo',
      style: 'padding: 24px; max-width: 800px; margin: 0 auto;'
    },
    children: [
      {
        type: 'h2',
        props: { style: 'margin: 0 0 24px 0; font-size: 28px; font-weight: 600;' },
        children: '搜索过滤示例'
      },
      {
        type: 'ElCard',
        props: {
          shadow: 'hover',
          style: 'margin-bottom: 20px;'
        },
        children: [
          {
            type: 'div',
            props: {
              style: 'display: flex; flex-direction: column; gap: 16px;'
            },
            children: [
              {
                type: 'ElInput',
                props: {
                  placeholder: '搜索商品名称...',
                  clearable: true,
                  style: 'width: 100%;'
                },
                model: 'searchQuery',
                children: [
                  {
                    type: 'template',
                    slot: 'prefix',
                    children: [
                      {
                        type: 'ElIcon',
                        children: [
                          { type: 'Search' }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                type: 'ElSelect',
                props: {
                  placeholder: '选择分类',
                  clearable: true,
                  style: 'width: 100%;'
                },
                model: 'selectedCategory',
                children: [
                  {
                    type: 'ElOption',
                    props: { label: '全部', value: '' }
                  },
                  {
                    type: 'ElOption',
                    props: { label: '电子产品', value: 'electronics' }
                  },
                  {
                    type: 'ElOption',
                    props: { label: '服装', value: 'clothing' }
                  },
                  {
                    type: 'ElOption',
                    props: { label: '食品', value: 'food' }
                  },
                  {
                    type: 'ElOption',
                    props: { label: '图书', value: 'books' }
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        type: 'ElCard',
        props: {
          shadow: 'never',
          header: '搜索结果 ({{ filteredItems.length }} 项)'
        },
        children: [
          {
            type: 'div',
            cond: '{{ filteredItems.length === 0 }}',
            props: { style: 'text-align: center; padding: 40px; color: #909399;' },
            children: '没有找到匹配的商品'
          },
          {
            type: 'div',
            loop: {
              items: '{{ filteredItems }}',
              itemKey: 'item'
            },
            props: {
              style: 'padding: 16px; margin: 8px 0; border: 1px solid #ebeef5; border-radius: 4px;'
            },
            children: [
              {
                type: 'div',
                props: {
                  style: 'display: flex; justify-content: space-between; align-items: center;'
                },
                children: [
                  {
                    type: 'div',
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: 'font-size: 18px; font-weight: 600; margin-bottom: 8px;'
                        },
                        children: '{{ item.name }}'
                      },
                      {
                        type: 'div',
                        props: {
                          style: 'color: #909399; font-size: 14px; margin-bottom: 4px;'
                        },
                        children: '分类: {{ item.category === "electronics" ? "电子产品" : item.category === "clothing" ? "服装" : item.category === "food" ? "食品" : item.category === "books" ? "图书" : item.category }}'
                      },
                      {
                        type: 'ElTag',
                        loop: {
                          items: '{{ item.tags }}',
                          itemKey: 'tag'
                        },
                        props: {
                          size: 'small',
                          style: 'margin-right: 4px;'
                        },
                        children: '{{ tag }}'
                      }
                    ]
                  },
                  {
                    type: 'div',
                    props: {
                      style: 'font-size: 24px; font-weight: bold; color: #f56c6c;'
                    },
                    children: '¥{{ item.price }}'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }

  const initialItems = [
    { id: 1, name: 'iPhone 15 Pro', category: 'electronics', price: 7999, tags: ['手机', '苹果'] },
    { id: 2, name: 'MacBook Pro', category: 'electronics', price: 12999, tags: ['笔记本', '苹果'] },
    { id: 3, name: 'T恤', category: 'clothing', price: 99, tags: ['休闲', '夏季'] },
    { id: 4, name: '牛仔裤', category: 'clothing', price: 299, tags: ['休闲', '经典'] },
    { id: 5, name: '苹果', category: 'food', price: 12, tags: ['水果', '健康'] },
    { id: 6, name: '面包', category: 'food', price: 8, tags: ['早餐', '主食'] },
    { id: 7, name: 'Vue.js 实战', category: 'books', price: 89, tags: ['编程', '前端'] },
    { id: 8, name: 'TypeScript 指南', category: 'books', price: 79, tags: ['编程', '类型'] }
  ]

  // 注意：不要在 initialState 中定义 filteredItems，它会由 computed 自动计算
  const initialState: SearchFilterState = {
    items: initialItems,
    searchQuery: '',
    selectedCategory: ''
  }

  const { vnode, state, ctx } = useVario(searchFilterSchema, {
    app,
    state: initialState,
    computed: {
      filteredItems: (state: SearchFilterState) => {
        let result = state.items
        
        // 按搜索关键词过滤
        if (state.searchQuery) {
          const query = (state.searchQuery as string).toLowerCase()
          result = result.filter((item) => 
            item.name.toLowerCase().includes(query) ||
            item.tags.some((tag) => tag.toLowerCase().includes(query))
          )
        }
        
        // 按分类过滤
        if (state.selectedCategory) {
          result = result.filter((item) => item.category === state.selectedCategory)
        }
        
        return result
      }
    },
    methods: {},
    onError: (error) => {
      console.error('[SearchFilter] Error:', error)
    }
  })

  return {
    vnode,
    state,
    ctx
  }
}
