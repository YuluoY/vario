<template>
  <div class="examples-view">

    <div class="masonry-container">
      <ExampleCard
        v-for="example in examples"
        :key="example.codeId"
        :title="$t(example.titleKey)"
        :code="example.code"
        :schema="example.schema"
        :code-id="example.codeId"
        :icon="example.icon"
        :language="example.language"
        :show-preview="example.showPreview"
        :initial-state="example.initialState"
        :methods="example.methods"
      />
    </div>

    <!-- 资源卡片 -->
    <div class="resources-section">
      <el-row :gutter="24">
        <el-col :xs="24" :sm="8">
          <el-card class="resource-card">
            <template #header>
              <div class="card-header">
                <el-icon><Link /></el-icon>
                <span>{{ $t('examples.documentation') }}</span>
              </div>
            </template>
            <p>{{ $t('examples.completeApiReference') }}</p>
            <el-button type="primary" link>{{ $t('examples.viewDocs') }} →</el-button>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-card class="resource-card">
            <template #header>
              <div class="card-header">
                <el-icon><Link /></el-icon>
                <span>{{ $t('examples.github') }}</span>
              </div>
            </template>
            <p>{{ $t('examples.sourceCodeAndContributions') }}</p>
            <el-button type="primary" link>{{ $t('examples.viewRepo') }} →</el-button>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-card class="resource-card">
            <template #header>
              <div class="card-header">
                <el-icon><Link /></el-icon>
                <span>{{ $t('examples.community') }}</span>
              </div>
            </template>
            <p>{{ $t('examples.joinDiscussionsAndHelp') }}</p>
            <el-button type="primary" link>{{ $t('examples.join') }} →</el-button>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, defineComponent, h, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DocumentChecked,
  Operation,
  DataAnalysis,
  DocumentCopy,
  View,
  Document,
  Link
} from '@element-plus/icons-vue'
import { ElCard, ElButton, ElIcon, ElMessage } from 'element-plus'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { useVario } from '@vario/vue'
import type { Schema } from '@vario/schema'
import {
  buttonExample,
  inputExample,
  listExample,
  conditionalExample,
  cardExample,
  formExample,
  tableExample,
  dialogExample,
  tabsExample,
  setInstructionExample,
  ifInstructionExample,
  loopInstructionExample,
  emitInstructionExample,
  batchInstructionExample,
  waitInstructionExample,
  accessExpressionExample,
  mathExpressionExample,
  arrayExpressionExample,
  conditionalExpressionExample,
  functionExpressionExample,
  nestedExpressionExample,
  logicalExpressionExample,
  calculatorExample,
  todoExample,
  shoppingCartExample,
  searchFilterExample
} from '@src/examples/examples.vario'
import type { ExampleItem } from '@src/examples/examples.vario'

// 示例卡片组件
const ExampleCard = defineComponent({
  name: 'ExampleCard',
  props: {
    title: {
      type: String,
      required: true
    },
    code: {
      type: String,
      required: true
    },
    schema: {
      type: Object as () => Schema | null,
      default: null
    },
    codeId: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      default: 'DocumentChecked'
    },
    language: {
      type: String,
      default: 'json'
    },
    showPreview: {
      type: Boolean,
      default: true
    },
    initialState: {
      type: Object as () => Record<string, any> | undefined,
      default: undefined
    },
    methods: {
      type: Object as () => any,
      default: undefined
    }
  },
  setup(props) {
    const showCode = ref(true)
    const codeRef = ref<HTMLElement | null>(null)
    const copiedId = ref<string | null>(null)
    
    // 格式化语言标签为小写
    const formatLanguage = (lang: string) => {
      return lang.toLowerCase()
    }
    
    const copyCode = async () => {
      try {
        await navigator.clipboard.writeText(props.code)
        copiedId.value = props.codeId
        setTimeout(() => {
          copiedId.value = null
        }, 2000)
        ElMessage.success('代码已复制')
      } catch (err) {
        ElMessage.error('复制失败')
      }
    }
    
    const highlightCode = () => {
      if (codeRef.value) {
        const originalText = codeRef.value.textContent || ''
        const trimmedText = originalText.replace(/\s+$/, '')
        if (originalText !== trimmedText) {
          codeRef.value.textContent = trimmedText
        }
        hljs.highlightElement(codeRef.value)
      }
    }
    
    // 渲染预览
    let previewVnode: any = null
    if (props.schema && props.showPreview) {
      // 优先使用示例配置中的 initialState，否则根据 schema 类型提供默认状态
      let state: Record<string, any> = props.initialState || {}
      
      if (!props.initialState) {
        // 默认状态逻辑（向后兼容）
        if (props.schema.type === 'ElInput') {
          state = { inputValue: '' }
        } else if (props.schema.type === 'div' && props.code.includes('items')) {
          state = { items: ['Apple', 'Banana', 'Cherry'] }
        } else if (props.schema.type === 'ElAlert') {
          state = { showSuccess: true }
        } else if (props.schema.type === 'ElCard' && props.code.includes('title')) {
          state = { title: 'Card Title', description: 'This is a card description' }
        } else if (props.schema.type === 'ElForm') {
          state = { name: '', email: '' }
        } else if (props.schema.type === 'ElTable') {
          state = {
            tableData: [
              { name: 'John', age: 25, address: 'New York' },
              { name: 'Jane', age: 30, address: 'London' }
            ]
          }
        } else if (props.schema.type === 'ElDialog') {
          state = { dialogVisible: true }
        } else if (props.schema.type === 'ElTabs') {
          state = { activeTab: 'tab1' }
        }
      }
      
      const { vnode } = useVario(props.schema, {
        state,
        methods: props.methods,
        onError: (error) => {
          console.error('[ExampleCard] Render error:', error)
        }
      })
      previewVnode = vnode
    }
    
    onMounted(() => {
      if (showCode.value) {
        nextTick(() => {
          highlightCode()
        })
      }
    })
    
    watch(() => showCode.value, (newVal) => {
      if (newVal) {
        nextTick(() => {
          highlightCode()
        })
      }
    })
    
    return () => {
      const iconMap: Record<string, any> = {
        DocumentChecked,
        Operation,
        DataAnalysis
      }
      const Icon = iconMap[props.icon] || DocumentChecked
      
      return h(ElCard, { 
        class: 'example-card',
        style: { height: 'auto', display: 'flex', flexDirection: 'column' }
      }, {
        header: () => h('div', { class: 'card-header' }, [
          h('div', { class: 'card-header-left' }, [
            h(ElIcon, {}, { default: () => h(Icon) }),
            h('span', {}, props.title)
          ]),
          props.showPreview && h('div', { class: 'card-header-actions' }, [
            h(ElButton, {
              text: true,
              size: 'small',
              onClick: () => { showCode.value = !showCode.value }
            }, {
              default: () => [
                h(ElIcon, { style: 'margin-right: 4px;' }, {
                  default: () => h(showCode.value ? View : Document)
                }),
                showCode.value ? '预览' : '代码'
              ]
            })
          ])
        ]),
        default: () => showCode.value ? h('div', { class: 'code-block-wrapper' }, [
          h('div', { class: 'code-header' }, [
            h('span', { class: 'code-lang' }, formatLanguage(props.language)),
            h(ElButton, {
              text: true,
              size: 'small',
              onClick: copyCode,
              class: 'copy-btn'
            }, {
              default: () => [
                h(ElIcon, { style: 'margin-right: 4px; font-size: 14px;' }, { default: () => h(DocumentCopy) }),
                copiedId.value === props.codeId ? '已复制' : '复制'
              ]
            })
          ]),
          h('div', { class: 'code-wrapper' }, [
            h('pre', { class: 'source-code' }, [
              h('code', {
                ref: codeRef,
                class: `language-${props.language}`
              }, props.code.trimEnd())
            ])
          ])
        ]) : h('div', { class: 'preview-wrapper' }, [
          previewVnode?.value ? h('div', { class: 'preview-content' }, previewVnode.value) : h('div', { class: 'preview-placeholder' }, '无法预览此示例')
        ])
      })
    }
  }
})

// @ts-ignore
const { t } = useI18n()

const examples = computed<ExampleItem[]>(() => [
  buttonExample,
  inputExample,
  listExample,
  conditionalExample,
  cardExample,
  formExample,
  tableExample,
  dialogExample,
  tabsExample,
  setInstructionExample,
  ifInstructionExample,
  loopInstructionExample,
  emitInstructionExample,
  batchInstructionExample,
  waitInstructionExample,
  accessExpressionExample,
  mathExpressionExample,
  arrayExpressionExample,
  conditionalExpressionExample,
  functionExpressionExample,
  nestedExpressionExample,
  logicalExpressionExample,
  calculatorExample,
  todoExample,
  shoppingCartExample,
  searchFilterExample
])
</script>

<style scoped lang="scss">
@use '@src/styles/abstracts/variables' as *;
@use '@src/styles/abstracts/mixins' as *;

.examples-view {
  animation: fadeIn 0.5s ease;
}

.page-header {
  margin-bottom: $spacing-xl;
  text-align: center;
  
  h1 {
    @include typography-h1;
    margin-bottom: $spacing-sm;
    color: var(--text-primary);
  }
  
  p {
    @include typography-body;
    font-size: $font-size-h4-desktop;
    color: var(--text-secondary);
    margin-bottom: 0;
    
    @include respond-below(xs) {
      font-size: $font-size-body-mobile;
    }
  }
}

.masonry-container {
  column-count: 1;
  column-gap: $spacing-lg;
  margin-bottom: $spacing-xxl;
  
  @include respond-above(sm) {
    column-count: 2;
  }
  
  @include respond-above(lg) {
    column-count: 3;
  }
  
  @include respond-above(xl) {
    column-count: 4;
  }
}

.resources-section {
  margin-top: $spacing-xxl;
  margin-bottom: $spacing-xxl;
  
  .resource-card {
    height: 100%;
    background: var(--bg-card);
    border: 1px solid var(--border-default);
    @include transition-transform($transition-base);
    
    &:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }
    
    .card-header {
      display: flex;
      align-items: center;
      gap: $spacing-sm;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    p {
      @include typography-body;
      color: var(--text-secondary);
      margin-bottom: $spacing-md;
    }
  }
}

.example-card {
  display: inline-block;
  width: 100%;
  margin-bottom: $spacing-lg;
  break-inside: avoid;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  @include transition-transform($transition-base);
  vertical-align: top;
  height: auto;
  
  // el-card 本身（因为 .example-card 直接应用在 el-card 上）
  &.el-card {
    height: auto !important;
    display: flex !important;
    flex-direction: column !important;
    background: var(--bg-card) !important;
  }
  
  &:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
  
  :deep(.el-card__header) {
    flex-shrink: 0 !important;
    padding: $spacing-md !important;
    background: var(--bg-card) !important;
    border-bottom: 1px solid var(--border-default) !important;
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      font-weight: 600;
      color: var(--text-primary);
      
      &-left {
        display: flex;
        align-items: center;
        gap: $spacing-sm;
        flex: 1;
        min-width: 0;
        
        :deep(.el-icon) {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: var(--primary-base);
          flex-shrink: 0;
        }
        
        span {
          font-size: $font-size-body-desktop;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.5;
        }
      }
      
      &-actions {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        margin-left: $spacing-md;
      }
    }
  }
  
  :deep(.el-card__body) {
    padding: 0 !important;
    flex: 1 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-height: 200px !important;
    background: var(--bg-card) !important;
    height: auto !important;
  }
  
  .preview-wrapper {
    padding: $spacing-md;
    min-height: 200px;
    background: var(--bg-base);
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .preview-content {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }
    
    .preview-placeholder {
      text-align: center;
      color: var(--text-secondary);
      padding: $spacing-xl;
    }
  }
}

.code-example,
.example-card :deep(.code-block-wrapper) {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: $radius-md;
  overflow: hidden;
  width: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  
  .code-header {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: $spacing-sm $spacing-md;
    background: var(--bg-hover);
    border-bottom: 1px solid var(--border-default);
    
    .code-lang {
      font-size: $font-size-aux-desktop;
      color: var(--text-secondary);
      font-weight: 500;
      text-transform: lowercase;
    }
    
    .copy-btn {
      color: var(--text-secondary);
      font-size: $font-size-aux-desktop;
      padding: $spacing-xs $spacing-sm;
      height: auto;
      line-height: 1.5;
      
      &:hover {
        color: var(--primary-base);
        background: var(--bg-hover);
      }
      
      :deep(.el-icon) {
        font-size: 14px !important;
        width: 14px !important;
        height: 14px !important;
        margin-right: 4px;
        vertical-align: middle;
      }
      
      :deep(span) {
        vertical-align: middle;
      }
    }
  }
  
  .code-wrapper {
    display: flex;
    overflow: auto;
    background: #0d1117;
    flex: 1;
    min-height: 150px;
    max-height: 500px;
    
    .source-code {
      flex: 1;
      margin: 0;
      padding: $spacing-md;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #c9d1d9;
      white-space: pre;
      overflow-x: auto;
      background: transparent;
      
      code {
        display: block;
        padding: 0;
        background: transparent;
        border: none;
        color: inherit;
        font-family: inherit;
        font-size: inherit;
        white-space: pre;
        word-wrap: normal;
      }
    }
  }
}

.resource-item {
  padding: $spacing-md;
  text-align: center;
  background: var(--bg-card);
  border-radius: $radius-md;
  border: 1px solid var(--border-default);
  @include transition-transform($transition-base);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
  }

  h3 {
    @include typography-h4;
    margin-bottom: $spacing-sm;
    color: var(--text-primary);
  }

  p {
    @include typography-body;
    color: var(--text-secondary);
    margin-bottom: $spacing-md;
  }
}

.mt-6 {
  margin-top: $spacing-md;
}

.mb-4 {
  margin-bottom: $spacing-md;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
