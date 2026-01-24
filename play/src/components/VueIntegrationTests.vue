<template>
  <div class="vue-integration-tests">
    <h2>{{ $t('vueIntegrationTests.title') }}</h2>
    <p class="description">{{ $t('vueIntegrationTests.description') }}</p>

    <el-row :gutter="24">
      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><MagicStick /></el-icon>
              <span>{{ $t('vueIntegrationTests.schemaPreview') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('vueIntegrationTests.liveSchemaRendering')"
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('vueIntegrationTests.realtimeRendering') }}</p>
          </el-alert>

          <el-form label-width="100px">
            <el-form-item :label="$t('vueIntegrationTests.schemaType')">
              <el-select v-model="selectedSchema" :placeholder="$t('vueIntegrationTests.selectSchema')" @change="loadSchema">
                <el-option :label="$t('vueIntegrationTests.simpleForm')" value="simpleForm" />
                <el-option :label="$t('vueIntegrationTests.counterApp')" value="counterApp" />
                <el-option :label="$t('vueIntegrationTests.todoList')" value="todoList" />
                <el-option :label="$t('vueIntegrationTests.conditionalUI')" value="conditionalUI" />
                <el-option :label="$t('vueIntegrationTests.dataGrid')" value="dataGrid" />
              </el-select>
            </el-form-item>
          </el-form>

          <div class="schema-editor">
            <h4>{{ $t('vueIntegrationTests.schemaJson') }}</h4>
            <el-input
              v-model="schemaJson"
              type="textarea"
              :rows="12"
              @change="updateSchema"
            />
            <el-button class="mt-2" type="primary" @click="loadSchema">
              {{ $t('vueIntegrationTests.applySchema') }}
            </el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><View /></el-icon>
              <span>{{ $t('vueIntegrationTests.renderedOutput') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('vueIntegrationTests.vueComponentPreview')"
            type="success"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('vueIntegrationTests.renderedVueComponents') }}</p>
          </el-alert>

          <div class="render-output">
            <div v-if="renderVNode" class="component-preview">
              <!-- 直接渲染 VNode，Vue 3 会自动处理 Fragment -->
              <component :is="renderVNode" v-if="renderVNode" />
            </div>
            <el-empty v-else :description="$t('vueIntegrationTests.noSchemaRendered')" />
            <!-- Debug info -->
            <div v-if="renderVNode" class="debug-info">
              <strong>{{ $t('vueIntegrationTests.debugInfo') }}:</strong>
              <pre style="font-size: 11px; margin-top: 5px;">{{ JSON.stringify({
                type: (renderVNode as any)?.type?.toString() || (renderVNode as any)?.type?.name || 'unknown',
                hasProps: !!(renderVNode as any)?.props,
                hasChildren: !!(renderVNode as any)?.children,
                childrenType: Array.isArray((renderVNode as any)?.children) ? 'array' : typeof (renderVNode as any)?.children
              }, null, 2) }}</pre>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-6">
      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><DataBoard /></el-icon>
              <span>{{ $t('vueIntegrationTests.runtimeState') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('vueIntegrationTests.reactiveStateManagement')"
            type="warning"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('vueIntegrationTests.watchStateChanges') }}</p>
          </el-alert>

          <div class="state-display">
            <h4>{{ $t('vueIntegrationTests.currentState') }}</h4>
            <pre class="code-block">{{ JSON.stringify(runtimeState, null, 2) }}</pre>
          </div>

          <el-divider />

          <div class="state-actions">
            <h4>{{ $t('vueIntegrationTests.manualStateUpdate') }}</h4>
            <el-form v-if="stateUpdateForm" :model="stateUpdateForm" label-width="100px">
              <el-form-item :label="$t('vueIntegrationTests.path')">
                <el-input v-model="stateUpdateForm.path" :placeholder="$t('vueIntegrationTests.pathPlaceholder')" />
              </el-form-item>
              <el-form-item :label="$t('vueIntegrationTests.value')">
                <el-input
                  v-model="stateUpdateForm.value"
                  type="textarea"
                  :rows="2"
                  :placeholder="$t('vueIntegrationTests.jsonValue')"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="manualUpdateState">{{ $t('vueIntegrationTests.updateState') }}</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><List /></el-icon>
              <span>{{ $t('vueIntegrationTests.eventLog') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('vueIntegrationTests.trackEvents')"
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('vueIntegrationTests.monitorEvents') }}</p>
          </el-alert>

          <div class="event-log-display">
            <div class="log-header">
              <el-button size="small" @click="clearEventLog">{{ $t('vueIntegrationTests.clearLog') }}</el-button>
              <span class="event-count">{{ (eventLog && eventLog.length) || 0 }} {{ $t('vueIntegrationTests.events') }}</span>
            </div>
            <div class="log-container">
              <div v-for="(event, index) in (eventLog || [])" :key="index" class="log-entry">
                <span class="log-time">{{ event.time }}</span>
                <el-tag size="small" type="primary">{{ event.name }}</el-tag>
                <span class="log-data">{{ JSON.stringify(event.data) }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-6">
      <el-col :span="24">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Document /></el-icon>
              <span>{{ $t('vueIntegrationTests.integrationFeatures') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('vueIntegrationTests.varioVueCapabilities')"
            type="success"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('vueIntegrationTests.comprehensiveTest') }}</p>
          </el-alert>

          <el-row :gutter="16" class="feature-row">
            <el-col :xs="12" :sm="8" :md="6">
              <div class="feature-item">
                <el-icon class="feature-icon"><Check /></el-icon>
                <h5>{{ $t('vueIntegrationTests.schemaToVNode') }}</h5>
                <p>{{ $t('vueIntegrationTests.convertVarioSchema') }}</p>
              </div>
            </el-col>
            <el-col :xs="12" :sm="8" :md="6">
              <div class="feature-item">
                <el-icon class="feature-icon"><Check /></el-icon>
                <h5>{{ $t('vueIntegrationTests.reactiveState') }}</h5>
                <p>{{ $t('vueIntegrationTests.autoSyncState') }}</p>
              </div>
            </el-col>
            <el-col :xs="12" :sm="8" :md="6">
              <div class="feature-item">
                <el-icon class="feature-icon"><Check /></el-icon>
                <h5>{{ $t('vueIntegrationTests.twoWayBinding') }}</h5>
                <p>{{ $t('vueIntegrationTests.vModelIntegration') }}</p>
              </div>
            </el-col>
            <el-col :xs="12" :sm="8" :md="6">
              <div class="feature-item">
                <el-icon class="feature-icon"><Check /></el-icon>
                <h5>{{ $t('vueIntegrationTests.eventHandling') }}</h5>
                <p>{{ $t('vueIntegrationTests.schemaEventsToHandlers') }}</p>
              </div>
            </el-col>
            <el-col :xs="12" :sm="8" :md="6">
              <div class="feature-item">
                <el-icon class="feature-icon"><Check /></el-icon>
                <h5>{{ $t('vueIntegrationTests.conditionalRendering') }}</h5>
                <p>{{ $t('vueIntegrationTests.condAndShowDirectives') }}</p>
              </div>
            </el-col>
            <el-col :xs="12" :sm="8" :md="6">
              <div class="feature-item">
                <el-icon class="feature-icon"><Check /></el-icon>
                <h5>{{ $t('vueIntegrationTests.listRendering') }}</h5>
                <p>{{ $t('vueIntegrationTests.loopDirective') }}</p>
              </div>
            </el-col>
            <el-col :xs="12" :sm="8" :md="6">
              <div class="feature-item">
                <el-icon class="feature-icon"><Check /></el-icon>
                <h5>{{ $t('vueIntegrationTests.expressionEval') }}</h5>
                <p>{{ $t('vueIntegrationTests.interpolationInProps') }}</p>
              </div>
            </el-col>
            <el-col :xs="12" :sm="8" :md="6">
              <div class="feature-item">
                <el-icon class="feature-icon"><Check /></el-icon>
                <h5>{{ $t('vueIntegrationTests.globalComponents') }}</h5>
                <p>{{ $t('vueIntegrationTests.autoResolveComponents') }}</p>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MagicStick, View, DataBoard, List, Document, Check } from '@element-plus/icons-vue'
import { useVario, type VueRendererOptions } from '@variojs/vue'
import type { Schema } from '@variojs/schema'
import { 
  defaultStates, 
  createSchemasFactory,
  createMethodsFactory,
  integrationComputed
} from '../examples/vue-integration.vario'

// @ts-ignore
const { t } = useI18n()

// 选择与调试态
const selectedSchema = ref('simpleForm')
const schemaJson = ref('')
const eventLog = ref<Array<{ time: string; name: string; data: any }>>([])
const runtimeState = ref<any>({})

const stateUpdateForm = reactive({
  path: '',
  value: ''
})

// 当前运行态（透传给 useVario，Composition 风格 state）
const integrationState = reactive({ ...defaultStates[selectedSchema.value] })

// Schema 示例（使用函数生成，以便在语言切换时重新计算）
const getSchemas = createSchemasFactory(t)

const schemas = computed(() => getSchemas())

// 注意：updateSchema 不能直接修改 computed，需要创建一个可编辑的副本
// 必须在 currentSchema 之前定义，因为 currentSchema 会使用它
const editableSchemas = reactive<Record<string, Schema>>({})
watch(schemas, (newSchemas) => {
  Object.assign(editableSchemas, newSchemas)
}, { immediate: true, deep: true })

// renderer 选项（保持可扩展）
const renderOptions: VueRendererOptions = {}

// 事件记录
const logEvent = (name: string, data?: any) => {
  const time = new Date().toLocaleTimeString()
  eventLog.value.push({ time, name, data })
}

// 当前 schema（响应式）- 优先使用可编辑版本，否则使用计算版本
const currentSchema = computed(() => {
  const key = selectedSchema.value
  return editableSchemas[key] || schemas.value[key]
})

// 创建 methods
const methods = createMethodsFactory(logEvent)

const { vnode, state, ctx } = useVario(currentSchema, {
  state: integrationState,
  computed: integrationComputed,
  methods,
  onEmit: (event: string, data?: any) => logEvent(event, data),
  onError: (error: Error) => {
    console.error('[Vario Integration] Error:', error)
    alert('Error: ' + error.message)
  },
  rendererOptions: renderOptions
})

const renderVNode = computed(() => vnode.value)

watch(state, (newState) => {
  runtimeState.value = JSON.parse(JSON.stringify(newState))
}, { deep: true, immediate: true })

const resetStateForSchema = (schemaKey: string) => {
  const defaultState = defaultStates[schemaKey]
  if (!defaultState) return
  
  // 获取默认状态的键
  const stateKeys = Object.keys(defaultState)
  const currentKeys = Object.keys(integrationState)
  
  // 删除不在新 state 中的属性（但跳过 computed 属性和系统属性）
  currentKeys.forEach((key) => {
    // 跳过 computed 属性（todoCompleted, totalUsers）和系统属性
    if (!stateKeys.includes(key) && 
        !key.startsWith('$') && 
        !key.startsWith('_') &&
        key !== 'todoCompleted' && 
        key !== 'totalUsers') {
      try {
        // 使用 Reflect.deleteProperty 来安全删除
        Reflect.deleteProperty(integrationState as any, key)
      } catch (e) {
        // 忽略无法删除的属性（如 computed）
        console.warn(`Cannot delete property ${key}:`, e)
      }
    }
  })
  
  // 更新现有属性或添加新属性
  // 使用深拷贝，确保嵌套对象和数组也是响应式的
  const newState = JSON.parse(JSON.stringify(defaultState))
  Object.keys(newState).forEach((key) => {
    const value = newState[key]
    // 如果是数组或对象，需要确保是响应式的
    if (Array.isArray(value)) {
      ;(integrationState as any)[key] = reactive([...value])
    } else if (value !== null && typeof value === 'object') {
      ;(integrationState as any)[key] = reactive({ ...value })
    } else {
      ;(integrationState as any)[key] = value
    }
  })
}

const loadSchema = () => {
  const schema = schemas.value[selectedSchema.value]
  if (schema) {
    schemaJson.value = JSON.stringify(schema, null, 2)
    resetStateForSchema(selectedSchema.value)
    clearEventLog()
  }
}

const updateSchema = () => {
  try {
    const schema = JSON.parse(schemaJson.value)
    editableSchemas[selectedSchema.value] = schema
    // 更新 computed schemas 的引用（通过重新计算）
    // 注意：这不会真正更新 computed，但会触发 currentSchema 重新计算
    Object.assign(editableSchemas, getSchemas())
    editableSchemas[selectedSchema.value] = schema
  } catch (error: any) {
    alert('Invalid JSON: ' + error.message)
  }
}

const manualUpdateState = () => {
  try {
    if (!stateUpdateForm || !stateUpdateForm.path) {
      return
    }
    const path = stateUpdateForm.path
    const valueStr = stateUpdateForm.value || ''
    if (!path || !valueStr) {
      alert('Please provide both path and value')
      return
    }
    const value = JSON.parse(valueStr)
    const currentCtx = ctx?.value
    if (currentCtx && typeof currentCtx._set === 'function') {
      currentCtx._set(path, value)
      runtimeState.value = { ...runtimeState.value, [path]: value }
    } else {
      console.warn('[VueIntegrationTests] Context not available or _set method not found')
    }
  } catch (error: any) {
    alert('Invalid value: ' + error.message)
  }
}

const clearEventLog = () => {
  eventLog.value = []
}

// 初始化
loadSchema()
</script>

<style scoped lang="scss">
.vue-integration-tests {
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

.schema-editor {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-2);
  }
}

.render-output {
  min-height: 300px;
  
  .component-preview {
    padding: var(--space-4);
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-base);
    min-height: 250px;
  }
}

.state-display {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-2);
  }
}

.code-block {
  background: var(--color-bg-tertiary);
  padding: var(--space-4);
  border-radius: var(--radius-base);
  overflow-x: auto;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  max-height: 300px;
}

.state-actions {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-2);
  }
}

.event-log-display {
  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
  }

  .event-count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  padding: var(--space-4);
}

.log-entry {
  display: grid;
  grid-template-columns: 80px 120px 1fr;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.log-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-family: var(--font-family-mono);
}

.log-data {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feature-row {
  :deep(.el-col) {
    display: flex;
    margin-bottom: var(--space-4);
  }
}

.feature-item {
  padding: var(--space-4);
  text-align: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;

  .feature-icon {
    font-size: var(--font-size-2xl);
    color: var(--color-success);
    margin-bottom: var(--space-2);
    flex-shrink: 0;
  }

  h5 {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    margin-bottom: var(--space-1);
    flex-shrink: 0;
  }

  p {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0;
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
}

.mt-2 {
  margin-top: var(--space-2);
}

.mt-4 {
  margin-top: var(--space-4);
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
