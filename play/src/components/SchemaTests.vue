<template>
  <div class="schema-tests">
    <h2>{{ $t('schemaTests.title') }}</h2>
    <p class="description">{{ $t('schemaTests.description') }}</p>

    <el-row :gutter="24">
      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><DocumentChecked /></el-icon>
              <span>{{ t('schemaTests.schemaEditor') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('schemaTests.defineSchemas')"
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ t('schemaTests.createJsonSchemas') }}</p>
          </el-alert>

          <el-form label-width="100px">
            <el-form-item :label="$t('schemaTests.schema')">
              <el-input
                v-model="schemaInput"
                type="textarea"
                :rows="12"
                :placeholder="$t('schemaTests.schemaPlaceholder', JSON.stringify({ type: 'div', children: 'Hello World' }, null, 2))"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="renderSchema">{{ t('schemaTests.renderSchema') }}</el-button>
              <el-button @click="loadSchemaExample('button')">{{ t('schemaTests.button') }}</el-button>
              <el-button @click="loadSchemaExample('input')">{{ t('schemaTests.input') }}</el-button>
              <el-button @click="loadSchemaExample('list')">{{ t('schemaTests.list') }}</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><View /></el-icon>
              <span>{{ t('schemaTests.renderPreview') }}</span>
            </div>
          </template>

          <div class="preview-area">
            <div v-if="renderedVnode" class="rendered-content">
              <!-- Vue 会自动解包 Ref，所以直接使用 renderedVnode -->
              <component :is="renderedVnode" />
            </div>
            <div v-else class="placeholder">
              <el-icon :size="60" color="#E5E7EB"><Document /></el-icon>
              <p>{{ t('schemaTests.noSchemaRenderedYet') }}</p>
            </div>
            <!-- Debug info -->
            <div v-if="renderedVnode" class="debug-info">
              <strong>{{ t('schemaTests.debugInfo') }}</strong>
              <pre style="font-size: 11px; margin-top: 5px;">{{ JSON.stringify({
                hasVnode: !!renderedVnode,
                type: (renderedVnode as any)?.type?.toString() || (renderedVnode as any)?.type?.name || 'unknown',
                hasProps: !!(renderedVnode as any)?.props,
                hasChildren: !!(renderedVnode as any)?.children
              }, null, 2) }}</pre>
            </div>
          </div>

          <el-divider />

          <div class="validation-result">
            <h4>{{ t('schemaTests.validationStatus') }}</h4>
            <el-tag :type="validationResult.valid ? 'success' : 'danger'">
              {{ validationResult.valid ? t('schemaTests.valid') : t('schemaTests.invalid') }}
            </el-tag>
            <p v-if="validationResult.message" class="validation-message">
              {{ validationResult.message }}
            </p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-6">
      <el-col :xs="24">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Connection /></el-icon>
              <span>{{ t('schemaTests.schemaFeatures') }}</span>
            </div>
          </template>

          <el-row :gutter="24">
            <el-col :xs="24" :md="8">
              <div class="feature-item">
                <h4>{{ t('schemaTests.conditionalRendering') }}</h4>
                <p class="feature-description">
                  {{ t('schemaTests.conditionalRenderingDescription') }}
                </p>
                <el-button size="small" @click="toggleConditional">
                  {{ t('schemaTests.toggleVisibility') }}
                </el-button>
                <div v-if="showConditional" class="conditional-content">
                  <el-tag type="success">{{ t('schemaTests.conditionalContent') }}</el-tag>
                </div>
              </div>
            </el-col>

            <el-col :xs="24" :md="8">
              <div class="feature-item">
                <h4>{{ t('schemaTests.listRendering') }}</h4>
                <p class="feature-description">
                  {{ t('schemaTests.listRenderingDescription') }}
                </p>
                <el-button size="small" @click="addItem">{{ t('schemaTests.addItem') }}</el-button>
                <div class="list-content">
                  <el-tag v-for="(item, index) in listItems" :key="index" class="list-item">
                    {{ t('schemaTests.item', [index, item]) }}
                  </el-tag>
                </div>
              </div>
            </el-col>

            <el-col :xs="24" :md="8">
              <div class="feature-item">
                <h4>{{ t('schemaTests.eventHandling') }}</h4>
                <p class="feature-description">
                  {{ t('schemaTests.eventHandlingDescription') }}
                </p>
                <el-button type="primary" size="small" @click="handleClick">
                  {{ t('schemaTests.clickMe', [clickCount]) }}
                </el-button>
                <p class="event-log">{{ t('schemaTests.clicks', [clickCount]) }}</p>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { DocumentChecked, View, Document, Connection } from '@element-plus/icons-vue'
import { useVario } from '@vario/vue'
import { schemaExamples } from '../examples/schema-tests.vario'

// @ts-ignore
const { t } = useI18n()

const schemaInput = ref(JSON.stringify({
  type: 'ElButton',
  props: {
    type: 'primary'
  },
  children: 'Hello Vario!'
}, null, 2))

// renderedVnode 现在通过 computed 从 varioInstance 获取
const validationResult = reactive({
  valid: true,
  message: ''
})

const showConditional = ref(false)
const listItems = ref(['Apple', 'Banana', 'Cherry'])
const clickCount = ref(0)

const loadSchemaExample = (type: keyof typeof schemaExamples) => {
  schemaInput.value = JSON.stringify(schemaExamples[type], null, 2)
}

// 响应式的 schema（初始为空，等待用户输入）
const currentSchema = ref<any>({
  type: 'div',
  children: 'No schema loaded'
})

// 创建 useVario 实例（传入响应式的 schema）
const { vnode, ctx } = useVario(computed(() => currentSchema.value), {
  onEmit: (event: string, data?: unknown) => {
    console.log('[Schema Tests] Event:', event, data)
  },
  onError: (error) => {
    console.error('[Schema Tests] Error:', error)
    validationResult.valid = false
    validationResult.message = error.message
  }
})

// 响应式地获取 vnode（useVario 返回的 vnode 已经是 Ref）
const renderedVnode = vnode

const renderSchema = () => {
  try {
    const schema = JSON.parse(schemaInput.value)
    
    // Simple validation
    if (!schema.type) {
      throw new Error('Schema must have a "type" property')
    }
    
    validationResult.valid = true
    validationResult.message = ''
    
    // 更新响应式 schema，useVario 会自动重新渲染（因为传入了 computed）
    currentSchema.value = schema
    
    // 初始化示例所需的状态
    if (ctx.value) {
      // 为 list 示例初始化 items
      if (schemaInput.value.includes('items')) {
        ctx.value._set('items', ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'])
      }
      // 为 input 示例初始化 inputValue
      if (schemaInput.value.includes('inputValue')) {
        ctx.value._set('inputValue', '')
      }
    }
    
    console.log('[Schema Tests] Schema rendered:', schema)
  } catch (error: any) {
    validationResult.valid = false
    validationResult.message = error.message
    currentSchema.value = {
      type: 'div',
      children: 'Invalid schema'
    }
    console.error('[Schema Tests] Render failed:', error)
  }
}

const toggleConditional = () => {
  showConditional.value = !showConditional.value
}

const addItem = () => {
  const newItem = String.fromCharCode(65 + listItems.value.length)
  listItems.value.push(newItem)
}

const handleClick = () => {
  clickCount.value++
}
</script>

<style scoped lang="scss">
.schema-tests {
  animation: slideIn 0.5s ease;
}

h2 {
  font-size: var(--font-size-3xl);
  margin-bottom: var(--space-2);
}

.description {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-6);
}

.test-card {
  margin-bottom: var(--space-6);
  height: 100%;

  .card-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: var(--font-weight-semibold);
  }
}

.preview-area {
  min-height: 300px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

.rendered-content {
  width: 100%;
  padding: var(--space-4);
}

.placeholder {
  text-align: center;
  color: var(--color-text-tertiary);

  p {
    margin-top: var(--space-4);
    margin-bottom: 0;
  }
}

.validation-result {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-2);
  }
}

.validation-message {
  margin-top: var(--space-4);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.feature-item {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-2);
  }

  .feature-description {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-4);
    line-height: var(--line-height-normal);

    code {
      background: var(--color-bg-tertiary);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      font-family: var(--font-family-mono);
      font-size: var(--font-size-xs);
    }
  }

  .conditional-content {
    margin-top: var(--space-4);
    padding: var(--space-4);
    background: var(--color-success-light);
    border-radius: var(--radius-base);
    text-align: center;
  }

  .list-content {
    margin-top: var(--space-4);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .list-item {
    margin-bottom: 0;
  }

  .event-log {
    margin-top: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}

.mt-6 {
  margin-top: var(--space-6);
}

.mb-2 {
  margin-bottom: var(--space-2);
}

.mb-4 {
  margin-bottom: var(--space-4);
}

.debug-info {
  margin-top: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-hover);
  font-size: var(--font-size-aux-desktop);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  
  pre {
    font-size: var(--font-size-aux-mobile);
    margin-top: var(--space-1);
    color: var(--text-secondary);
    font-family: var(--font-family-mono);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
