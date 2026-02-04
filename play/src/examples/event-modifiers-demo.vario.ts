/**
 * 事件修饰符示例
 * 展示 Vario 事件修饰符的各种用法
 */

import type { ExampleItem } from './examples.vario'

// ==================== 事件名修饰符示例 ====================

export const eventNameModifiersExample: ExampleItem = {
  codeId: 'event-name-modifiers',
  titleKey: 'examples.eventNameModifiers',
  code: `{
  "type": "div",
  "props": {
    "style": {
      "padding": "20px",
      "border": "2px solid #ccc"
    }
  },
  "events": {
    "click": "handleOuterClick"
  },
  "children": [
    {
      "type": "ElButton",
      "events": {
        "click.stop.prevent": "handleInnerClick"
      },
      "children": "点击我（阻止冒泡和默认行为）"
    }
  ]
}`,
  schema: {
    type: 'div',
    props: {
      style: {
        padding: '20px',
        border: '2px solid #ccc'
      }
    },
    events: {
      click: 'handleOuterClick'
    },
    children: [
      {
        type: 'ElButton',
        events: {
          'click.stop.prevent': 'handleInnerClick'
        },
        children: '点击我（阻止冒泡和默认行为）'
      }
    ]
  },
  icon: 'Mouse',
  language: 'json',
  showPreview: true,
  category: 'schema',
  initialState: {
    clickCount: 0,
    lastClicked: ''
  },
  methods: {
    handleOuterClick: ({ state }) => {
      state.clickCount++
      state.lastClicked = 'outer'
      console.log('外层点击')
    },
    handleInnerClick: ({ state }) => {
      state.clickCount++
      state.lastClicked = 'inner'
      console.log('内层点击（已阻止冒泡）')
    }
  }
}

// ==================== 数组简写格式 - 修饰符数组 ====================

export const eventArrayModifiersExample: ExampleItem = {
  codeId: 'event-array-modifiers',
  titleKey: 'examples.eventArrayModifiers',
  code: `{
  "type": "form",
  "events": {
    "submit": ["call", "handleSubmit", [], ["prevent", "stop"]]
  },
  "children": [
    {
      "type": "ElInput",
      "model": "username",
      "props": {
        "placeholder": "用户名"
      }
    },
    {
      "type": "ElButton",
      "props": {
        "type": "primary",
        "nativeType": "submit"
      },
      "children": "提交"
    }
  ]
}`,
  schema: {
    type: 'form',
    events: {
      submit: ['call', 'handleSubmit', [], ['prevent', 'stop']]
    },
    children: [
      {
        type: 'ElInput',
        model: 'username',
        props: {
          placeholder: '用户名'
        }
      },
      {
        type: 'ElButton',
        props: {
          type: 'primary',
          nativeType: 'submit'
        },
        children: '提交'
      }
    ]
  },
  icon: 'EditPen',
  language: 'json',
  showPreview: true,
  category: 'schema',
  initialState: {
    username: '',
    submitCount: 0
  },
  methods: {
    handleSubmit: ({ state }) => {
      state.submitCount++
      console.log('表单提交:', state.username)
      // 表单不会实际提交，因为使用了 .prevent
    }
  }
}

// ==================== 数组简写格式 - 修饰符对象 ====================

export const eventObjectModifiersExample: ExampleItem = {
  codeId: 'event-object-modifiers',
  titleKey: 'examples.eventObjectModifiers',
  code: `{
  "type": "a",
  "props": {
    "href": "https://example.com",
    "target": "_blank"
  },
  "events": {
    "click": ["call", "handleLinkClick", [], { "prevent": true, "stop": true }]
  },
  "children": "点击链接（已阻止跳转）"
}`,
  schema: {
    type: 'a',
    props: {
      href: 'https://example.com',
      target: '_blank'
    },
    events: {
      click: ['call', 'handleLinkClick', [], { prevent: true, stop: true }]
    },
    children: '点击链接（已阻止跳转）'
  },
  icon: 'Link',
  language: 'json',
  showPreview: true,
  category: 'schema',
  initialState: {
    clickCount: 0
  },
  methods: {
    handleLinkClick: ({ state }) => {
      state.clickCount++
      console.log('链接点击（已阻止导航）')
    }
  }
}

// ==================== 模态框示例 - .self 修饰符 ====================

export const modalSelfModifierExample: ExampleItem = {
  codeId: 'modal-self-modifier',
  titleKey: 'examples.modalSelfModifier',
  code: `{
  "type": "div",
  "props": {
    "class": "modal-overlay",
    "style": {
      "position": "fixed",
      "top": 0,
      "left": 0,
      "right": 0,
      "bottom": 0,
      "background": "rgba(0,0,0,0.5)",
      "display": "flex",
      "alignItems": "center",
      "justifyContent": "center"
    }
  },
  "cond": "{{ showModal }}",
  "events": {
    "click.self": "closeModal"
  },
  "children": [
    {
      "type": "div",
      "props": {
        "class": "modal-content",
        "style": {
          "background": "white",
          "padding": "30px",
          "borderRadius": "8px",
          "minWidth": "300px"
        }
      },
      "children": [
        {
          "type": "h3",
          "children": "这是一个模态框"
        },
        {
          "type": "p",
          "children": "点击遮罩层（灰色区域）关闭"
        },
        {
          "type": "ElButton",
          "events": {
            "click": "closeModal"
          },
          "children": "关闭"
        }
      ]
    }
  ]
}`,
  schema: {
    type: 'div',
    children: [
      {
        type: 'ElButton',
        events: {
          click: 'openModal'
        },
        children: '打开模态框'
      },
      {
        type: 'div',
        props: {
          class: 'modal-overlay',
          style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }
        },
        cond: '{{ showModal }}',
        events: {
          'click.self': 'closeModal'
        },
        children: [
          {
            type: 'div',
            props: {
              class: 'modal-content',
              style: {
                background: 'white',
                padding: '30px',
                borderRadius: '8px',
                minWidth: '300px'
              }
            },
            children: [
              {
                type: 'h3',
                children: '这是一个模态框'
              },
              {
                type: 'p',
                children: '点击遮罩层（灰色区域）关闭'
              },
              {
                type: 'ElButton',
                events: {
                  click: 'closeModal'
                },
                children: '关闭'
              }
            ]
          }
        ]
      }
    ]
  },
  icon: 'Window',
  language: 'json',
  showPreview: true,
  category: 'application',
  initialState: {
    showModal: false
  },
  methods: {
    openModal: ({ state }) => {
      state.showModal = true
    },
    closeModal: ({ state }) => {
      state.showModal = false
    }
  }
}

// ==================== .once 修饰符示例 ====================

export const onceModifierExample: ExampleItem = {
  codeId: 'once-modifier',
  titleKey: 'examples.onceModifier',
  code: `{
  "type": "div",
  "children": [
    {
      "type": "ElButton",
      "events": {
        "click.once": "handleFirstClick"
      },
      "children": "只能点一次"
    },
    {
      "type": "p",
      "children": "点击次数: {{ clickCount }}"
    }
  ]
}`,
  schema: {
    type: 'div',
    children: [
      {
        type: 'ElButton',
        events: {
          'click.once': 'handleFirstClick'
        },
        children: '只能点一次'
      },
      {
        type: 'p',
        children: '点击次数: {{ clickCount }}'
      }
    ]
  },
  icon: 'SuccessFilled',
  language: 'json',
  showPreview: true,
  category: 'schema',
  initialState: {
    clickCount: 0
  },
  methods: {
    handleFirstClick: ({ state }) => {
      state.clickCount++
      console.log('这个事件只会触发一次')
    }
  }
}

// ==================== 混合使用修饰符 ====================

export const mixedModifiersExample: ExampleItem = {
  codeId: 'mixed-modifiers',
  titleKey: 'examples.mixedModifiers',
  code: `{
  "type": "div",
  "children": [
    {
      "type": "form",
      "events": {
        "submit.prevent": ["call", "handleSubmit", [], ["stop"]]
      },
      "children": [
        {
          "type": "ElInput",
          "model": "email",
          "props": {
            "placeholder": "邮箱地址"
          }
        },
        {
          "type": "ElButton",
          "props": {
            "type": "primary",
            "nativeType": "submit"
          },
          "children": "订阅"
        }
      ]
    },
    {
      "type": "p",
      "children": "提交次数: {{ submitCount }}"
    }
  ]
}`,
  schema: {
    type: 'div',
    children: [
      {
        type: 'form',
        events: {
          'submit.prevent': ['call', 'handleSubmit', [], ['stop']]
        },
        children: [
          {
            type: 'ElInput',
            model: 'email',
            props: {
              placeholder: '邮箱地址'
            }
          },
          {
            type: 'ElButton',
            props: {
              type: 'primary',
              nativeType: 'submit'
            },
            children: '订阅'
          }
        ]
      },
      {
        type: 'p',
        children: '提交次数: {{ submitCount }}'
      }
    ]
  },
  icon: 'Promotion',
  language: 'json',
  showPreview: true,
  category: 'application',
  initialState: {
    email: '',
    submitCount: 0
  },
  methods: {
    handleSubmit: ({ state }) => {
      state.submitCount++
      console.log('表单提交:', state.email)
      // 事件名修饰符 .prevent 和数组简写修饰符 ['stop'] 都会生效
    }
  }
}

// ==================== 指令示例 ====================

export const directiveFocusExample: ExampleItem = {
  codeId: 'directive-focus',
  titleKey: 'examples.directiveFocus',
  code: `{
  "type": "ElInput",
  "model": "username",
  "directives": {
    "focus": true
  },
  "props": {
    "placeholder": "自动聚焦"
  }
}`,
  schema: {
    type: 'ElInput',
    model: 'username',
    directives: {
      focus: true
    },
    props: {
      placeholder: '自动聚焦'
    }
  },
  icon: 'View',
  language: 'json',
  showPreview: true,
  category: 'schema',
  initialState: {
    username: ''
  }
}

export const directiveArrayExample: ExampleItem = {
  codeId: 'directive-array',
  titleKey: 'examples.directiveArray',
  code: `{
  "type": "div",
  "directives": [
    ["focus", true],
    ["custom", "{{ myValue }}", "arg", { "lazy": true }]
  ],
  "children": "带多个指令的元素"
}`,
  schema: {
    type: 'div',
    directives: [
      ['focus', true]
    ],
    children: '带指令的元素'
  },
  icon: 'MagicStick',
  language: 'json',
  showPreview: true,
  category: 'schema',
  initialState: {
    myValue: 'test'
  }
}

// 导出所有示例
export const eventModifiersExamples = [
  eventNameModifiersExample,
  eventArrayModifiersExample,
  eventObjectModifiersExample,
  modalSelfModifierExample,
  onceModifierExample,
  mixedModifiersExample,
  directiveFocusExample,
  directiveArrayExample
]
