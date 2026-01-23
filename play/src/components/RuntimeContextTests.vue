<template>
  <div class="runtime-context-tests">
    <h2>{{ $t('runtimeContextTests.title') }}</h2>
    <p class="description">{{ $t('runtimeContextTests.description') }}</p>

    <el-row :gutter="24">
      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><DataAnalysis /></el-icon>
              <span>{{ $t('runtimeContextTests.stateManagement') }}</span>
            </div>
          </template>
          
          <el-form :model="stateForm" label-width="120px">
            <el-form-item :label="$t('runtimeContextTests.username')">
              <el-input v-model="stateForm.username" :placeholder="$t('runtimeContextTests.enterUsername')" />
            </el-form-item>
            <el-form-item :label="$t('runtimeContextTests.age')">
              <el-input-number v-model="stateForm.age" :min="0" :max="150" />
            </el-form-item>
            <el-form-item :label="$t('runtimeContextTests.active')">
              <el-switch v-model="stateForm.active" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="updateState">{{ $t('runtimeContextTests.updateState') }}</el-button>
              <el-button @click="resetState">{{ $t('runtimeContextTests.reset') }}</el-button>
            </el-form-item>
          </el-form>

          <el-divider />
          
          <div class="state-display">
            <h4>{{ $t('runtimeContextTests.currentState') }}</h4>
            <pre class="code-block">{{ JSON.stringify(stateForm, null, 2) }}</pre>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Lock /></el-icon>
              <span>{{ t('runtimeContextTests.proxyProtection') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('runtimeContextTests.systemApiProtection')"
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ t('runtimeContextTests.protectionDescription') }}</p>
          </el-alert>

          <el-form :model="protectionForm" label-width="120px">
            <el-form-item :label="t('runtimeContextTests.protectedKey')">
              <el-input v-model="protectionForm.key" :placeholder="t('runtimeContextTests.protectedKeyPlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('runtimeContextTests.value')">
              <el-input v-model="protectionForm.value" :placeholder="t('runtimeContextTests.attemptToSetValue')" />
            </el-form-item>
            <el-form-item>
              <el-button type="danger" @click="attemptOverride">
                {{ t('runtimeContextTests.attemptOverride') }}
              </el-button>
            </el-form-item>
          </el-form>

          <el-divider />

          <div class="protection-result">
            <h4>{{ t('runtimeContextTests.result') }}</h4>
            <el-tag :type="protectionResult.success ? 'success' : 'danger'" size="large">
              {{ protectionResult.message }}
            </el-tag>
            <p v-if="protectionResult.success" class="mt-2" style="color: #67c23a; font-size: 12px;">
              ✓ {{ t('runtimeContextTests.proxyProtectionWorking') }}
            </p>
            <p v-else class="mt-2" style="color: #f56c6c; font-size: 12px;">
              ✗ {{ t('runtimeContextTests.securityIssueDetected') }}
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
              <el-icon><Tools /></el-icon>
              <span>{{ t('runtimeContextTests.methodRegistration') }}</span>
            </div>
          </template>

          <el-row :gutter="24">
            <el-col :xs="24" :md="12">
              <h4>{{ t('runtimeContextTests.customMethod') }}</h4>
              <el-input
                v-model="customMethod.name"
                :placeholder="t('runtimeContextTests.methodNamePlaceholder')"
                class="mb-2"
              />
              <el-input
                v-model="customMethod.body"
                type="textarea"
                :rows="4"
                :placeholder="t('runtimeContextTests.returnJsonResult', JSON.stringify({ result: 'a + b' }))"
              />
              <el-button type="primary" @click="registerMethod" class="mt-2">
                {{ t('runtimeContextTests.registerMethod') }}
              </el-button>
            </el-col>

            <el-col :xs="24" :md="12">
              <h4>{{ t('runtimeContextTests.callMethod') }}</h4>
              <el-select
                v-model="selectedMethod"
                :placeholder="t('runtimeContextTests.selectMethod')"
                style="width: 100%; margin-bottom: var(--space-4);"
              >
                <el-option
                  v-for="method in availableMethods"
                  :key="method.name"
                  :label="method.name"
                  :value="method.name"
                />
              </el-select>
              <el-input
                v-model="methodParams"
                type="textarea"
                :rows="2"
                :placeholder="t('runtimeContextTests.enterParametersJson', JSON.stringify({ a: 1, b: 2 }))"
              />
              <el-button type="success" @click="callMethod" class="mt-2">
                {{ t('runtimeContextTests.executeMethod') }}
              </el-button>

              <div v-if="methodResult" class="mt-4">
                <h4>{{ t('runtimeContextTests.methodResult') }}</h4>
                <pre class="code-block">{{ JSON.stringify(methodResult, null, 2) }}</pre>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { DataAnalysis, Lock, Tools } from '@element-plus/icons-vue'
import { createRuntimeContext, type RuntimeContext } from '@vario/core'

// @ts-ignore
const { t } = useI18n()

const stateForm = reactive({
  username: 'testuser',
  age: 25,
  active: true
})

const ctx = ref<RuntimeContext | null>(null)
const stateDisplay = ref({})

// Initialize context
try {
  ctx.value = createRuntimeContext({
    username: stateForm.username,
    age: stateForm.age,
    active: stateForm.active
  })
  stateDisplay.value = { ...stateForm }
} catch (error) {
  console.error('Failed to create context:', error)
}

const updateState = () => {
  if (ctx.value) {
    try {
      ctx.value.username = stateForm.username
      ctx.value.age = stateForm.age
      ctx.value.active = stateForm.active
      stateDisplay.value = { ...stateForm }
    } catch (error) {
      console.error('Failed to update state:', error)
    }
  }
}

const resetState = () => {
  stateForm.username = 'testuser'
  stateForm.age = 25
  stateForm.active = true
  updateState()
}

// Proxy Protection Tests
const protectionForm = reactive({
  key: '$emit',
  value: 'hacked'
})

const protectionResult = ref({
  success: true,
  message: t('runtimeContextTests.readyToTest')
})

const attemptOverride = () => {
  if (ctx.value) {
    try {
      ctx.value[protectionForm.key] = protectionForm.value
      // 如果成功覆盖，这是安全漏洞！
      protectionResult.value = {
        success: false,
        message: t('runtimeContextTests.securityBreach')
      }
    } catch (error: any) {
      // 被阻止是预期的行为，这是保护机制正常工作
      protectionResult.value = {
        success: true,
        message: t('runtimeContextTests.protectionWorking', { 0: error.message })
      }
    }
  }
}

// Method Registration Tests
const customMethod = reactive({
  name: 'greet',
  body: JSON.stringify({ greeting: 'Hello, ${name}!' })
})

const selectedMethod = ref('')
const methodParams = ref('')
const methodResult = ref<any>(null)

const availableMethods = ref([
  { name: 'set', description: t('runtimeContextTests.setMethodDescription') },
  { name: 'emit', description: t('runtimeContextTests.emitMethodDescription') },
  { name: 'log', description: t('runtimeContextTests.logMethodDescription') }
])

const registerMethod = () => {
  if (ctx.value) {
    const handler = async (_context: RuntimeContext, params: any) => {
      const parsedBody = JSON.parse(customMethod.body)
      // Simple template replacement
      const greeting = parsedBody.greeting.replace('${name}', params.name || 'World')
      return { greeting }
    }

    ctx.value.$methods[customMethod.name] = handler
    availableMethods.value.push({
      name: customMethod.name,
      description: 'Custom method'
    })
  }
}

const callMethod = async () => {
  if (ctx.value && selectedMethod.value) {
    try {
      const params = methodParams.value ? JSON.parse(methodParams.value) : {}
      const method = ctx.value.$methods[selectedMethod.value]
      if (method) {
        methodResult.value = await method(ctx.value, params)
      }
    } catch (error: any) {
      methodResult.value = { error: error.message }
    }
  }
}
</script>

<style scoped lang="scss">
.runtime-context-tests {
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

.code-block {
  background: var(--color-bg-tertiary);
  padding: var(--space-4);
  border-radius: var(--radius-base);
  overflow-x: auto;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  max-height: 200px;
}

.state-display,
.protection-result {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-2);
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
