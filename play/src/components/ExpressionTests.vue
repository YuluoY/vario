<template>
  <div class="expression-tests">
    <h2>{{ $t('expressionTests.title') }}</h2>
    <p class="description">{{ $t('expressionTests.description') }}</p>

    <el-row :gutter="24">
      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Document /></el-icon>
              <span>{{ $t('expressionTests.basicEvaluation') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('expressionTests.testDifferentExpressions')"
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('expressionTests.evaluateUsingVario') }}</p>
          </el-alert>

          <el-form label-width="100px">
            <el-form-item :label="$t('expressionTests.expression')">
              <el-input
                v-model="expressionInput"
                type="textarea"
                :rows="3"
                :placeholder="$t('expressionTests.enterExpression')"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="evaluateExpression">
                {{ $t('expressionTests.evaluate') }}
              </el-button>
              <el-button @click="loadExample(0)">{{ $t('expressionTests.loadExample') }} 1</el-button>
              <el-button @click="loadExample(1)">{{ $t('expressionTests.loadExample') }} 2</el-button>
              <el-button @click="loadExample(2)">{{ $t('expressionTests.loadExample') }} 3</el-button>
            </el-form-item>
          </el-form>

          <el-divider />

          <div class="result-display">
            <h4>{{ $t('expressionTests.result') }}</h4>
            <el-tag :type="evaluationResult.success ? 'success' : 'danger'" size="large">
              {{ evaluationResult.value }}
            </el-tag>
            <pre v-if="evaluationResult.error" class="error-message">{{ evaluationResult.error }}</pre>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><DataBoard /></el-icon>
              <span>{{ $t('expressionTests.contextState') }}</span>
            </div>
          </template>

          <div class="state-editor">
            <h4>{{ $t('expressionTests.availableVariables') }}</h4>
            <div class="variable-list">
              <div v-for="(value, key) in contextState" :key="key" class="variable-item">
                <span class="variable-key">{{ key }}:</span>
                <span class="variable-value">{{ JSON.stringify(value) }}</span>
              </div>
            </div>

            <el-divider />

            <h4>{{ $t('expressionTests.updateContext') }}</h4>
            <el-form :model="updateForm" label-width="100px">
              <el-form-item :label="$t('expressionTests.variable')">
                <el-input v-model="updateForm.key" :placeholder="$t('expressionTests.variableName')" />
              </el-form-item>
              <el-form-item :label="$t('expressionTests.valueJson')">
                <el-input
                  v-model="updateForm.value"
                  type="textarea"
                  :rows="2"
                  :placeholder="$t('expressionTests.jsonValue')"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="updateContext">
                  {{ $t('expressionTests.update') }}
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-6">
      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Clock /></el-icon>
              <span>{{ $t('expressionTests.cachingPerformance') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('expressionTests.expressionCaching')"
            type="success"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('expressionTests.cachingDescription') }}</p>
          </el-alert>

          <el-form label-width="120px">
            <el-form-item :label="$t('expressionTests.iterations')">
              <el-input-number v-model="cacheTest.iterations" :min="1" :max="10000" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="runCacheTest" :loading="cacheTest.loading" :disabled="cacheTest.loading">
                {{ $t('expressionTests.runCacheTest') }}
              </el-button>
            </el-form-item>
          </el-form>

          <div v-if="cacheTest.result" class="cache-result">
            <el-row :gutter="16">
              <el-col :span="12">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('expressionTests.firstEval') }}:</div>
                  <div class="stat-value">{{ cacheTest.result.first }}ms</div>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('expressionTests.cachedEval') }}:</div>
                  <div class="stat-value">{{ cacheTest.result.cached }}ms</div>
                </div>
              </el-col>
            </el-row>
            <div class="improvement">
              {{ $t('expressionTests.speedup', [ (cacheTest.result.first / cacheTest.result.cached).toFixed(2) ]) }}
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Warning /></el-icon>
              <span>{{ $t('expressionTests.securityValidation') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('expressionTests.astWhitelistValidation')"
            type="warning"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('expressionTests.astValidationDescription') }}</p>
          </el-alert>

          <el-button-group>
            <el-button @click="testSecurity('safe')">{{ $t('expressionTests.testSafeExpression') }}</el-button>
            <el-button type="danger" @click="testSecurity('unsafe')">{{ $t('expressionTests.testUnsafeExpression') }}</el-button>
          </el-button-group>

          <div v-if="securityTest.result" class="security-result mt-4">
            <h4>{{ $t('expressionTests.testResult') }}</h4>
            <el-tag :type="securityTest.success ? 'success' : 'danger'">
              {{ securityTest.success ? $t('expressionTests.passed') : $t('expressionTests.blocked') }}
            </el-tag>
            <p class="mt-2">{{ securityTest.result }}</p>
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
              <span>{{ $t('expressionTests.astVisualization') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('expressionTests.abstractSyntaxTree')"
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('expressionTests.astDescription') }}</p>
          </el-alert>

          <div v-if="astData.ast" class="ast-display">
            <h4>{{ $t('expressionTests.parsedAst') }}</h4>
            <div class="json-tree">
              <pre>{{ JSON.stringify(astData.ast, null, 2) }}</pre>
            </div>
            <div class="validation-status mt-4">
              <el-tag :type="astData.isValid ? 'success' : 'danger'">
                {{ astData.isValid ? $t('expressionTests.validAst') : $t('expressionTests.invalidAst') }}
              </el-tag>
              <div v-if="astData.validationErrors.length > 0" class="validation-errors mt-2">
                <h5>{{ $t('expressionTests.validationErrors') }}</h5>
                <ul>
                  <li v-for="error in astData.validationErrors" :key="error">{{ error }}</li>
                </ul>
              </div>
            </div>
          </div>
          <div v-else class="no-ast">
            <el-empty :description="$t('expressionTests.noExpressionParsedYet')" />
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Clock /></el-icon>
              <span>{{ $t('expressionTests.cacheMonitoring') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('expressionTests.expressionCacheState')"
            type="success"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('expressionTests.cacheMonitoringDescription') }}</p>
          </el-alert>

          <div class="cache-stats">
            <el-row :gutter="16">
              <el-col :span="12">
                <div class="stat-card">
                  <div class="stat-label">{{ $t('expressionTests.cachedExpressions') }}</div>
                  <div class="stat-value">{{ cacheInfo.cachedExpressions }}</div>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="stat-card">
                  <div class="stat-label">{{ $t('expressionTests.cacheSize') }}</div>
                  <div class="stat-value">{{ cacheInfo.cacheSize }}</div>
                </div>
              </el-col>
            </el-row>
            
            <div v-if="cacheInfo.cachedExpressions > 0" class="cached-expressions-list mt-4">
              <h5>{{ $t('expressionTests.cachedExpressionsList') }}</h5>
              <div class="expression-list">
                <el-tag 
                  v-for="(expr, index) in cacheInfo.expressions" 
                  :key="index"
                  class="expression-tag"
                  size="small"
                >
                  {{ expr.length > 30 ? expr.substring(0, 30) + '...' : expr }}
                </el-tag>
              </div>
            </div>
            
            <div v-if="cacheInfo.lastExpression" class="last-expression mt-4">
              <h5>{{ $t('expressionTests.lastExpression') }}</h5>
              <pre class="expression-code">{{ cacheInfo.lastExpression }}</pre>
            </div>
            
            <div class="cache-actions mt-6">
              <el-button-group>
                <el-button type="primary" @click="updateCacheInfo">
                  {{ $t('expressionTests.refreshCacheInfo') }}
                </el-button>
                <el-button type="danger" @click="handleClearCache">
                  {{ $t('expressionTests.clearCache') }}
                </el-button>
              </el-button-group>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Document, DataBoard, Clock, Warning } from '@element-plus/icons-vue'
import { createRuntimeContext, evaluate, parseExpression, validateAST, clearCache, invalidateCache, getCacheStats } from '@variojs/core'

// @ts-ignore
const { t } = useI18n()

const expressionInput = ref('user.name + " is " + user.age + " years old"')
const evaluationResult = ref({
  success: false,
  value: '',
  error: ''
})

const contextState = reactive({
  user: {
    name: 'Alice',
    age: 28,
    active: true
  },
  count: 0,
  items: [1, 2, 3, 4, 5]
})

const updateForm = reactive({
  key: '',
  value: ''
})

const cacheTest = reactive({
  iterations: 100,
  result: null as { first: number; cached: number } | null,
  loading: false
})

const securityTest = reactive({
  result: '',
  success: false
})

// AST visualization data
const astData = ref<{
  ast: any | null
  isValid: boolean
  validationErrors: string[]
}>({
  ast: null,
  isValid: false,
  validationErrors: []
})

// Cache monitoring
const cacheInfo = ref<{
  cachedExpressions: number
  cacheSize: string
  lastExpression: string | null
  expressions: string[]
}>({
  cachedExpressions: 0,
  cacheSize: '0 B',
  lastExpression: null,
  expressions: []
})

const ctx = createRuntimeContext(contextState)

const exampleExpressions = [
  'user.name + " is " + user.age + " years old"',
  'items.length > 2 ? "有多个项目" : "项目较少"',
  'count < 10 ? "Low" : count < 50 ? "Medium" : "High"'
]

const loadExample = (index: number) => {
  expressionInput.value = exampleExpressions[index]
}

const evaluateExpression = () => {
  const expr = expressionInput.value
  try {
    // Parse expression to AST
    const ast = parseExpression(expr)
    let isValid = false
    let validationErrors: string[] = []
    
    try {
      validateAST(ast)
      isValid = true
    } catch (error: any) {
      isValid = false
      validationErrors = [error.message]
    }
    
    // Update AST data
    astData.value = {
      ast,
      isValid,
      validationErrors
    }
    
    // Evaluate expression
    const result = evaluate(expr, ctx)
    evaluationResult.value = {
      success: true,
      value: String(result),
      error: ''
    }
    
    // Update cache info
    updateCacheInfo()
    
  } catch (error: any) {
    let errorMessage = error.message
    
    // 提供更友好的错误提示
    if (errorMessage.includes('ArrowFunctionExpression')) {
      errorMessage = '❌ 表达式包含箭头函数，这是不被允许的。\n\n' +
        'Vario 表达式系统不支持箭头函数（如 x => x > 2）以确保安全性。\n\n' +
        '💡 替代方案：\n' +
        '  • 使用条件表达式：items.length > 2 ? "多" : "少"\n' +
        '  • 使用数学函数：Math.max(...items)\n' +
        '  • 使用数组方法：array.slice(0, 5).length\n\n' +
        '原错误：' + errorMessage
    } else if (errorMessage.includes('FunctionExpression')) {
      errorMessage = '❌ 表达式包含函数表达式，这是不被允许的。\n\n' +
        'Vario 表达式系统不支持函数定义以确保安全性。\n\n' +
        '原错误：' + errorMessage
    }
    
    // If parsing or validation fails, clear AST data
    astData.value = {
      ast: null,
      isValid: false,
      validationErrors: [errorMessage]
    }
    
    evaluationResult.value = {
      success: false,
      value: '',
      error: errorMessage
    }
  }
}

const updateCacheInfo = () => {
  try {
    const stats = getCacheStats(ctx)
    
    // 计算缓存大小（简化版本：只计算表达式字符串大小）
    let totalSize = 0
    for (const expr of stats.expressions) {
      // 只计算表达式字符串的字节大小
      totalSize += new TextEncoder().encode(expr).length
      // 加上基本的元数据开销（每个条目约 200 字节）
      totalSize += 200
    }
    
    // 格式化大小
    let sizeStr: string
    if (totalSize === 0) {
      sizeStr = '0 B'
    } else if (totalSize < 1024) {
      sizeStr = `${totalSize} B`
    } else if (totalSize < 1024 * 1024) {
      sizeStr = `${(totalSize / 1024).toFixed(1)} KB`
    } else {
      sizeStr = `${(totalSize / (1024 * 1024)).toFixed(2)} MB`
    }
    
    cacheInfo.value = {
      cachedExpressions: stats.size,
      cacheSize: sizeStr,
      lastExpression: expressionInput.value || null,
      expressions: stats.expressions
    }
  } catch (error: any) {
    console.error('Failed to get cache stats:', error)
    cacheInfo.value = {
      cachedExpressions: 0,
      cacheSize: '0 B',
      lastExpression: expressionInput.value || null,
      expressions: []
    }
  }
}

const handleClearCache = () => {
  clearCache(ctx)
  updateCacheInfo()
}

// 初始化时更新缓存信息
onMounted(() => {
  updateCacheInfo()
})

const updateContext = () => {
  try {
    if (!updateForm.key || !updateForm.key.trim()) {
      alert('请输入变量名称')
      return
    }
    
    const key = updateForm.key.trim()
    
    // 解析 JSON 值
    let value: any
    try {
      value = JSON.parse(updateForm.value)
    } catch (parseError: any) {
      // 如果不是有效的 JSON，尝试作为原始值处理
      const trimmed = updateForm.value.trim()
      if (trimmed === 'true' || trimmed === 'false') {
        value = trimmed === 'true'
      } else if (trimmed === 'null') {
        value = null
      } else if (!isNaN(Number(trimmed)) && trimmed !== '') {
        value = Number(trimmed)
      } else if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        value = trimmed.slice(1, -1)
      } else {
        value = trimmed
      }
    }
    
    // 使用 _set 方法更新上下文（支持嵌套路径，如 "user.name"）
    ctx._set(key, value)
    
    // 同步更新 Vue 响应式状态
    const keys = key.split('.')
    if (keys.length === 1) {
      // 简单路径，直接更新
      (contextState as Record<string, any>)[key] = value
    } else {
      // 嵌套路径，需要递归更新
      let target: any = contextState
      for (let i = 0; i < keys.length - 1; i++) {
        const pathKey = keys[i]
        if (!(pathKey in target) || typeof target[pathKey] !== 'object' || target[pathKey] === null) {
          target[pathKey] = {}
        }
        target = target[pathKey]
      }
      target[keys[keys.length - 1]] = value
    }
    
    // 清除表达式缓存，使依赖此路径的表达式重新求值
    invalidateCache(key, ctx)
    
    // 显示成功提示
    console.log('上下文已更新:', key, '=', value)
    
    // 清空表单
    updateForm.key = ''
    updateForm.value = ''
  } catch (error: any) {
    alert('更新上下文失败: ' + error.message)
    console.error('Update context error:', error)
  }
}

const runCacheTest = async () => {
  cacheTest.loading = true
  cacheTest.result = null
  
  try {
    // 使用允许的表达式（避免 SpreadElement）
    const expression = 'user.name + " is " + user.age + " years old"'
    
    // 清除缓存，确保第一次求值不使用缓存
    clearCache(ctx)
    
    // 第一次求值（第一次调用会解析和求值，后续调用会使用缓存）
    const start1 = performance.now()
    for (let i = 0; i < cacheTest.iterations; i++) {
      evaluate(expression, ctx)
    }
    const time1 = performance.now() - start1

    // 第二次求值（全部使用缓存）
    const start2 = performance.now()
    for (let i = 0; i < cacheTest.iterations; i++) {
      evaluate(expression, ctx)
    }
    const time2 = performance.now() - start2

    cacheTest.result = {
      first: Math.round(time1 * 100) / 100,  // 保留2位小数
      cached: Math.round(time2 * 100) / 100
    }
    
    console.log('缓存测试完成:', {
      iterations: cacheTest.iterations,
      firstTime: cacheTest.result.first + 'ms',
      cachedTime: cacheTest.result.cached + 'ms',
      speedup: (cacheTest.result.first / cacheTest.result.cached).toFixed(2) + 'x'
    })
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('缓存测试失败:', errorMessage)
    cacheTest.result = null
    
    // 显示错误提示
    alert('缓存测试失败: ' + errorMessage)
  } finally {
    cacheTest.loading = false
  }
}

const testSecurity = (type: 'safe' | 'unsafe') => {
  try {
    if (type === 'safe') {
      const expr = 'user.name + " - " + user.age'
      const result = evaluate(expr, ctx)
      securityTest.result = `Safe expression evaluated: ${result}`
      securityTest.success = true
    } else {
      // Try unsafe expression (this should fail)
      const expr = 'window.location.href'
      const result = evaluate(expr, ctx)
      securityTest.result = `Unsafe expression was NOT blocked: ${result}`
      securityTest.success = false
    }
  } catch (error: any) {
    securityTest.result = `Blocked: ${error.message}`
    securityTest.success = type === 'safe' ? false : true
  }
}
</script>

<style scoped lang="scss">
.expression-tests {
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

.result-display {
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

.state-editor {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-2);
  }
}

.variable-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  padding: var(--space-4);
}

.variable-item {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.variable-key {
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-mono);
}

.variable-value {
  color: var(--color-text-secondary);
  font-family: var(--font-family-mono);
}

.cache-result {
  margin-top: var(--space-4);
}

.stat-item {
  text-align: center;
  padding: var(--space-4);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-base);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

.stat-value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

.improvement {
  margin-top: var(--space-4);
  text-align: center;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-success);
}

.security-result {
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

// New styles for AST and Cache monitoring
.ast-display {
  .json-tree {
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-base);
    padding: var(--space-4);
    max-height: 300px;
    overflow-y: auto;
    
    pre {
      margin: 0;
      font-family: var(--font-family-mono);
      font-size: var(--font-size-sm);
      line-height: 1.5;
    }
  }
  
  .validation-status {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .validation-errors {
    h5 {
      font-size: var(--font-size-sm);
      margin-bottom: var(--space-2);
    }
    
    ul {
      margin: 0;
      padding-left: var(--space-6);
      
      li {
        font-size: var(--font-size-sm);
        color: var(--color-error);
        margin-bottom: var(--space-1);
      }
    }
  }
}

.no-ast {
  text-align: center;
  padding: var(--space-8) 0;
}

.cache-stats {
  .stat-card {
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-base);
    padding: var(--space-6);
    text-align: center;
    
    .stat-label {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-2);
    }
    
    .stat-value {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-primary);
    }
  }
  
  .last-expression {
    .expression-code {
      background: var(--color-bg-tertiary);
      border-radius: var(--radius-base);
      padding: var(--space-4);
      font-family: var(--font-family-mono);
      font-size: var(--font-size-sm);
      overflow-x: auto;
    }
  }
  
  .cache-actions {
    display: flex;
    justify-content: center;
    gap: var(--space-4);
  }
  
  .cached-expressions-list {
    h5 {
      font-size: var(--font-size-sm);
      margin-bottom: var(--space-2);
      color: var(--color-text-secondary);
    }
    
    .expression-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      
      .expression-tag {
        margin: 0;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: var(--font-size-xs);
      }
    }
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
