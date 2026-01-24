<template>
  <div class="instruction-tests">
    <h2>{{ $t('instructionTests.title') }}</h2>
    <p class="description">{{ $t('instructionTests.description') }}</p>

    <el-row :gutter="24">
      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Operation /></el-icon>
              <span>{{ t('instructionTests.instructionPlayground') }}</span>
            </div>
          </template>

          <el-alert
            :title="t('instructionTests.writeAndExecute')"
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ t('instructionTests.defineInstructions') }}</p>
          </el-alert>

          <el-form label-width="100px">
            <el-form-item :label="t('instructionTests.instructions')">
              <el-input
                v-model="instructionInput"
                type="textarea"
                :rows="8"
                :placeholder="t('instructionTests.enterInstructions', JSON.stringify([{ type: 'set', path: 'counter', value: 1 }], null, 2))"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="executeInstructions">
                {{ t('instructionTests.execute') }}
              </el-button>
              <el-button @click="loadInstructionExample('set')">{{ t('instructionTests.setExample') }}</el-button>
              <el-button @click="loadInstructionExample('if')">{{ t('instructionTests.ifExample') }}</el-button>
              <el-button @click="loadInstructionExample('batch')">{{ t('instructionTests.batchExample') }}</el-button>
            </el-form-item>
          </el-form>

          <el-divider />

          <div class="execution-result">
            <h4>{{ t('instructionTests.executionResult') }}</h4>
            <el-tag :type="executionResult.success ? 'success' : 'danger'" size="large">
              {{ executionResult.success ? t('instructionTests.success') : t('instructionTests.failed') }}
            </el-tag>
            <pre v-if="executionResult.error" class="error-message">{{ executionResult.error }}</pre>
            <pre v-if="executionResult.log" class="log-message">{{ executionResult.log }}</pre>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><DataBoard /></el-icon>
              <span>{{ t('instructionTests.currentState') }}</span>
            </div>
          </template>

          <div class="state-display">
            <h4>{{ t('instructionTests.runtimeState') }}</h4>
            <pre class="code-block">{{ JSON.stringify(runtimeState, null, 2) }}</pre>
          </div>

          <el-divider />

          <div class="state-actions">
            <h4>{{ t('instructionTests.quickActions') }}</h4>
            <el-button-group>
              <el-button @click="quickAction('increment')">{{ t('instructionTests.incrementCounter') }}</el-button>
              <el-button @click="quickAction('reset')">{{ t('instructionTests.resetState') }}</el-button>
              <el-button @click="quickAction('random')">{{ t('instructionTests.randomValue') }}</el-button>
            </el-button-group>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-6">
      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><List /></el-icon>
              <span>{{ t('instructionTests.arrayOperations') }}</span>
            </div>
          </template>

          <el-alert
            :title="t('instructionTests.testArrayManipulation')"
            type="success"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ t('instructionTests.arrayManipulationDescription') }}</p>
          </el-alert>

          <el-button-group class="mb-4">
            <el-button @click="arrayOperation('push')">{{ t('instructionTests.push') }}</el-button>
            <el-button @click="arrayOperation('pop')">{{ t('instructionTests.pop') }}</el-button>
            <el-button @click="arrayOperation('shift')">{{ t('instructionTests.shift') }}</el-button>
            <el-button @click="arrayOperation('unshift')">{{ t('instructionTests.unshift') }}</el-button>
            <el-button @click="arrayOperation('splice')">{{ t('instructionTests.splice') }}</el-button>
          </el-button-group>

          <div class="array-display">
            <h4>{{ t('instructionTests.currentArray') }}</h4>
            <el-tag v-for="(item, index) in arrayState" :key="index" class="array-item">
              {{ item }}
            </el-tag>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Connection /></el-icon>
              <span>{{ t('instructionTests.eventSystem') }}</span>
            </div>
          </template>

          <el-alert
            :title="t('instructionTests.testEventEmission')"
            type="warning"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ t('instructionTests.eventSystemDescription') }}</p>
          </el-alert>

          <el-form :model="eventForm" label-width="120px">
            <el-form-item :label="t('instructionTests.eventName')">
              <el-input v-model="eventForm.name" :placeholder="t('instructionTests.eventNamePlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('instructionTests.eventData')">
              <el-input
                v-model="eventForm.data"
                type="textarea"
                :rows="2"
                :placeholder="t('instructionTests.jsonDataPlaceholder', JSON.stringify({ message: 'Hello' }))"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="emitEvent">{{ t('instructionTests.emitEvent') }}</el-button>
            </el-form-item>
          </el-form>

          <div class="event-log">
            <h4>{{ t('instructionTests.eventLog') }}</h4>
            <div class="log-container">
              <div v-for="(log, index) in eventLogs" :key="index" class="log-entry">
                <el-tag type="info" size="small">{{ log.event }}</el-tag>
                <span class="log-data">{{ JSON.stringify(log.data) }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { Operation, DataBoard, List, Connection } from '@element-plus/icons-vue'
import { createRuntimeContext, execute } from '@variojs/core'

// @ts-ignore
const { t } = useI18n()

const instructionInput = ref(JSON.stringify([
  { type: 'set', path: 'counter', value: 0 }
], null, 2))

const executionResult = reactive({
  success: false,
  error: '',
  log: ''
})

const runtimeState = reactive({
  counter: 0,
  message: '',
  active: false,
  user: { name: 'Alice', age: 28 }
})

const arrayState = ref([1, 2, 3, 4, 5])
const eventForm = reactive({
  name: 'testEvent',
  data: JSON.stringify({ message: 'Hello World' })
})

const eventLogs = ref<Array<{ event: string; data: any }>>([])

const ctx = createRuntimeContext({
  counter: runtimeState.counter,
  message: runtimeState.message,
  active: runtimeState.active,
  user: runtimeState.user
}, {
  onEmit: (event: string, data?: any) => {
    eventLogs.value.push({ event, data })
  }
})

const instructionExamples = {
  set: [
    { type: 'set', path: 'counter', value: '{{ counter + 1 }}' }
  ],
  if: [
    {
      type: 'if',
      cond: '{{ counter < 10 }}',
      then: [
        { type: 'set', path: 'message', value: 'Counter is low' }
      ],
      else: [
        { type: 'set', path: 'message', value: 'Counter is high' }
      ]
    }
  ],
  batch: [
    {
      type: 'batch',
      actions: [
        { type: 'set', path: 'counter', value: 0 },
        { type: 'set', path: 'message', value: 'Reset complete' },
        { type: 'set', path: 'active', value: true }
      ]
    }
  ]
}

const loadInstructionExample = (type: keyof typeof instructionExamples) => {
  instructionInput.value = JSON.stringify(instructionExamples[type], null, 2)
}

const executeInstructions = async () => {
  try {
    executionResult.error = ''
    executionResult.log = ''
    
    const instructions = JSON.parse(instructionInput.value)
    await execute(instructions, ctx)
    
    // Update reactive state
    runtimeState.counter = ctx.counter
    runtimeState.message = ctx.message
    runtimeState.active = ctx.active
    
    executionResult.success = true
    executionResult.log = 'Instructions executed successfully'
  } catch (error: any) {
    executionResult.success = false
    executionResult.error = error.message
  }
}

const quickAction = (type: string) => {
  switch (type) {
    case 'increment':
      ctx.counter++
      runtimeState.counter = ctx.counter
      break
    case 'reset':
      ctx.counter = 0
      ctx.message = ''
      ctx.active = false
      runtimeState.counter = 0
      runtimeState.message = ''
      runtimeState.active = false
      break
    case 'random':
      ctx.counter = Math.floor(Math.random() * 100)
      runtimeState.counter = ctx.counter
      break
  }
}

const arrayOperation = async (type: string) => {
  try {
    const instructions: any[] = []
    
    switch (type) {
      case 'push':
        instructions.push({ type: 'push', path: 'array', value: arrayState.value.length + 1 })
        break
      case 'pop':
        instructions.push({ type: 'pop', path: 'array' })
        break
      case 'shift':
        instructions.push({ type: 'shift', path: 'array' })
        break
      case 'unshift':
        instructions.push({ type: 'unshift', path: 'array', value: arrayState.value.length + 1 })
        break
      case 'splice':
        instructions.push({ type: 'splice', path: 'array', start: 1, deleteCount: 2, items: [99, 100] })
        break
    }

    // Update array in context
    ctx.array = [...arrayState.value]
    await execute(instructions, ctx)
    // Ensure ctx.array is an array before spreading
    const ctxArray = Array.isArray(ctx.array) ? ctx.array : []
    arrayState.value = [...ctxArray]
  } catch (error: any) {
    alert('Error: ' + error.message)
  }
}

const emitEvent = () => {
  try {
    const data = JSON.parse(eventForm.data)
    ctx.$emit(eventForm.name, data)
  } catch (error: any) {
    alert('Invalid JSON data: ' + error.message)
  }
}
</script>

<style scoped lang="scss">
.instruction-tests {
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

.execution-result {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-2);
  }
}

.error-message {
  background: var(--color-error-light);
  color: var(--color-error);
  padding: var(--space-4);
  border-radius: var(--radius-base);
  margin-top: var(--space-4);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
}

.log-message {
  background: var(--color-bg-tertiary);
  padding: var(--space-4);
  border-radius: var(--radius-base);
  margin-top: var(--space-4);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  max-height: 200px;
  overflow-y: auto;
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

.array-display {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-2);
  }
}

.array-item {
  margin-right: var(--space-2);
  margin-bottom: var(--space-2);
}

.event-log {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-2);
  }
}

.log-container {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  padding: var(--space-4);
}

.log-entry {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.log-data {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
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
