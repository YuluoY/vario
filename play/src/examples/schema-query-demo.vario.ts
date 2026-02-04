/**
 * Schema 查询功能可视化测试
 * 
 * 演示 Schema 查询的各种功能：
 * - findById: 通过 ID 查找节点
 * - find: 查找第一个匹配节点
 * - findAll: 查找所有匹配节点
 * - parent: 获取父节点
 * - patch: 修改节点属性
 * - stats: 统计信息
 */

import type { Schema } from '@variojs/schema'

export const schemaQueryDemo: Schema = {
  type: 'div',
  id: 'schema-query-demo',
  class: 'demo-container',
  children: [
    // 标题区域
    {
      type: 'div',
      class: 'demo-header',
      children: [
        {
          type: 'h2',
          children: 'Schema 查询功能演示'
        },
        {
          type: 'p',
          class: 'description',
          children: '演示 useVario 的 Schema 查询 API，包括查找、修改、统计等功能'
        }
      ]
    },

    // 统计信息区域
    {
      type: 'el-card',
      id: 'stats-card',
      props: {
        header: '📊 Schema 统计信息',
        shadow: 'hover'
      },
      class: 'stats-card',
      children: [
        {
          type: 'div',
          class: 'stats-grid',
          children: [
            {
              type: 'div',
              class: 'stat-item',
              children: [
                {
                  type: 'div',
                  class: 'stat-label',
                  children: '节点总数'
                },
                {
                  type: 'div',
                  id: 'node-count',
                  class: 'stat-value',
                  children: '{{ stats.nodeCount }}'
                }
              ]
            },
            {
              type: 'div',
              class: 'stat-item',
              children: [
                {
                  type: 'div',
                  class: 'stat-label',
                  children: '最大深度'
                },
                {
                  type: 'div',
                  id: 'max-depth',
                  class: 'stat-value',
                  children: '{{ stats.maxDepth }}'
                }
              ]
            }
          ]
        }
      ]
    },

    // 测试表单区域
    {
      type: 'el-card',
      id: 'test-form',
      props: {
        header: '📝 测试表单（用于查询）',
        shadow: 'hover'
      },
      class: 'test-form-card',
      children: [
        {
          type: 'el-form',
          props: {
            labelWidth: '120px'
          },
          children: [
            {
              type: 'el-form-item',
              id: 'username-item',
              props: {
                label: '用户名'
              },
              children: [
                {
                  type: 'el-input',
                  id: 'username-input',
                  model: 'formData.username',
                  props: {
                    placeholder: '请输入用户名',
                    clearable: true
                  }
                }
              ]
            },
            {
              type: 'el-form-item',
              id: 'email-item',
              props: {
                label: '邮箱'
              },
              children: [
                {
                  type: 'el-input',
                  id: 'email-input',
                  model: 'formData.email',
                  props: {
                    placeholder: '请输入邮箱',
                    clearable: true,
                    type: 'email'
                  }
                }
              ]
            },
            {
              type: 'el-form-item',
              id: 'password-item',
              props: {
                label: '密码'
              },
              children: [
                {
                  type: 'el-input',
                  id: 'password-input',
                  model: 'formData.password',
                  props: {
                    placeholder: '请输入密码',
                    type: 'password',
                    showPassword: true
                  }
                }
              ]
            },
            {
              type: 'el-form-item',
              id: 'age-item',
              props: {
                label: '年龄'
              },
              children: [
                {
                  type: 'el-input-number',
                  id: 'age-input',
                  model: 'formData.age',
                  props: {
                    min: 1,
                    max: 150
                  }
                }
              ]
            }
          ]
        }
      ]
    },

    // 查询操作区域
    {
      type: 'el-card',
      id: 'query-operations',
      props: {
        header: '🔍 查询操作',
        shadow: 'hover'
      },
      class: 'operations-card',
      children: [
        {
          type: 'div',
          class: 'button-group',
          children: [
            {
              type: 'el-button',
              id: 'find-by-id-btn',
              props: {
                type: 'primary',
                icon: 'Search'
              },
              children: '通过 ID 查找',
              events: {
                click: [
                  {
                    type: 'call',
                    method: 'testFindById'
                  }
                ]
              }
            },
            {
              type: 'el-button',
              id: 'find-inputs-btn',
              props: {
                type: 'success',
                icon: 'Filter'
              },
              children: '查找所有输入框',
              events: {
                click: [
                  {
                    type: 'call',
                    method: 'testFindAllInputs'
                  }
                ]
              }
            },
            {
              type: 'el-button',
              id: 'disable-all-btn',
              props: {
                type: 'warning',
                icon: 'Lock'
              },
              children: '禁用所有输入',
              events: {
                click: [
                  {
                    type: 'call',
                    method: 'testDisableAll'
                  }
                ]
              }
            },
            {
              type: 'el-button',
              id: 'enable-all-btn',
              props: {
                type: 'info',
                icon: 'Unlock'
              },
              children: '启用所有输入',
              events: {
                click: [
                  {
                    type: 'call',
                    method: 'testEnableAll'
                  }
                ]
              }
            },
            {
              type: 'el-button',
              id: 'get-parent-btn',
              props: {
                type: 'danger',
                icon: 'Top'
              },
              children: '获取父节点',
              events: {
                click: [
                  {
                    type: 'call',
                    method: 'testGetParent'
                  }
                ]
              }
            }
          ]
        }
      ]
    },

    // 查询结果显示区域
    {
      type: 'el-card',
      id: 'query-result',
      props: {
        header: '📋 查询结果',
        shadow: 'hover'
      },
      class: 'result-card',
      children: [
        {
          type: 'el-alert',
          cond: '{{ queryResult }}',
          props: {
            title: '{{ queryResultTitle }}',
            type: '{{ queryResultType }}',
            description: '{{ queryResultMessage }}',
            showIcon: true,
            closable: false
          }
        },
        {
          type: 'div',
          cond: '{{ !queryResult }}',
          class: 'empty-state',
          children: [
            {
              type: 'el-empty',
              props: {
                description: '点击上方按钮执行查询操作'
              }
            }
          ]
        }
      ]
    },

    // 代码示例区域
    {
      type: 'el-card',
      id: 'code-examples',
      props: {
        header: '💻 代码示例',
        shadow: 'hover'
      },
      class: 'code-card',
      children: [
        {
          type: 'el-collapse',
          model: 'activeExample',
          children: [
            {
              type: 'el-collapse-item',
              props: {
                title: '1. 通过 ID 查找节点',
                name: 'findById'
              },
              children: [
                {
                  type: 'pre',
                  children: [
                    {
                      type: 'code',
                      children: `const { findById } = useVario(schema)

// 查找 email 输入框
const emailNode = findById('email-input')
if (emailNode) {
  console.log('找到节点:', emailNode.node.type)
  console.log('节点路径:', emailNode.path)
  
  // 修改属性
  emailNode.patch({
    props: { placeholder: '新的提示文本' }
  })
}`
                    }
                  ]
                }
              ]
            },
            {
              type: 'el-collapse-item',
              props: {
                title: '2. 查找所有匹配节点',
                name: 'findAll'
              },
              children: [
                {
                  type: 'pre',
                  children: [
                    {
                      type: 'code',
                      children: `const { findAll } = useVario(schema)

// 查找所有输入框
const inputs = findAll(node => 
  node.type === 'el-input' || 
  node.type === 'el-input-number'
)

// 批量操作
inputs.forEach(wrapper => {
  wrapper.patch({
    props: { disabled: true }
  })
})`
                    }
                  ]
                }
              ]
            },
            {
              type: 'el-collapse-item',
              props: {
                title: '3. 获取父节点',
                name: 'getParent'
              },
              children: [
                {
                  type: 'pre',
                  children: [
                    {
                      type: 'code',
                      children: `const { findById } = useVario(schema)

const emailNode = findById('email-input')
if (emailNode) {
  // 获取父节点
  const parent = emailNode.parent()
  if (parent) {
    console.log('父节点类型:', parent.node.type)
    // 修改父节点
    parent.patch({
      class: 'highlighted'
    })
  }
}`
                    }
                  ]
                }
              ]
            },
            {
              type: 'el-collapse-item',
              props: {
                title: '4. 统计信息',
                name: 'stats'
              },
              children: [
                {
                  type: 'pre',
                  children: [
                    {
                      type: 'code',
                      children: `const { stats } = useVario(schema)

// 响应式统计信息
watchEffect(() => {
  console.log('节点总数:', stats.value.nodeCount)
  console.log('最大深度:', stats.value.maxDepth)
})

// 惰性计算 - 只在首次访问时遍历
// 后续访问直接使用缓存`
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

export default schemaQueryDemo
