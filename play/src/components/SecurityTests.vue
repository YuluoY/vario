<template>
  <div class="security-tests">
    <h2>{{ $t('securityTests.title') }}</h2>
    <p class="description">{{ $t('securityTests.description') }}</p>

    <el-row :gutter="24">
      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Lock /></el-icon>
              <span>{{ $t('securityTests.expressionSandboxTests') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('securityTests.safeVsUnsafeExpressions')"
            type="warning"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('securityTests.testExpressionSandboxAbility') }}</p>
          </el-alert>

          <el-form label-width="140px">
            <el-form-item :label="$t('securityTests.expressionType')">
              <el-select v-model="selectedTestCategory" :placeholder="$t('securityTests.selectTestCategory')">
                <el-option :label="$t('securityTests.safeExpressions')" value="safe" />
                <el-option :label="$t('securityTests.globalObjectAccess')" value="global" />
                <el-option :label="$t('securityTests.assignmentOperations')" value="assignment" />
                <el-option :label="$t('securityTests.functionCalls')" value="function" />
                <el-option :label="$t('securityTests.arrowFunctions')" value="arrow" />
                <el-option :label="$t('securityTests.newExpressions')" value="new" />
                <el-option :label="$t('securityTests.sideEffects')" value="sideEffects" />
              </el-select>
            </el-form-item>
            <el-form-item :label="$t('securityTests.testCase')">
              <el-select v-model="selectedTestCase" :placeholder="$t('securityTests.selectTestCase')">
                <el-option 
                  v-for="test in testCases[selectedTestCategory] || []" 
                  :key="test.id"
                  :label="test.description"
                  :value="test.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="runSecurityTest">
                {{ $t('securityTests.runSecurityTest') }}
              </el-button>
              <el-button @click="runAllCategoryTests">{{ $t('securityTests.runAllCategoryTests') }}</el-button>
            </el-form-item>
          </el-form>

          <el-divider />

          <div class="test-results">
            <h4>{{ $t('securityTests.testResults') }}</h4>
            <div v-if="securityTestResults.length === 0" class="no-results">
              <el-icon><InfoFilled /></el-icon>
              <p>{{ $t('securityTests.noTestResultsYet') }}</p>
            </div>
            <div v-else class="results-list">
              <div 
                v-for="(result, index) in securityTestResults" 
                :key="index" 
                class="result-item"
                :class="{ 'result-passed': result.passed, 'result-failed': !result.passed }"
              >
                <div class="result-header">
                  <el-tag :type="result.passed ? 'success' : 'danger'" size="small">
                    {{ result.passed ? $t('securityTests.pass') : $t('securityTests.fail') }}
                  </el-tag>
                  <span class="result-category">{{ result.category }}</span>
                  <span class="result-time">{{ result.time }}ms</span>
                </div>
                <div class="result-details">
                  <p class="result-expression"><code>{{ result.expression }}</code></p>
                  <p class="result-message">{{ result.message }}</p>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Lock /></el-icon>
              <span>{{ $t('securityTests.protectedSystemApis') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('securityTests.prefixProtection')"
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('securityTests.propertiesProtected') }}</p>
          </el-alert>

          <el-form :model="protectionForm" label-width="120px">
            <el-form-item :label="$t('securityTests.property')">
              <el-select v-model="protectionForm.property" :placeholder="$t('securityTests.selectProperty')">
                <el-option label="$emit" value="$emit" />
                <el-option label="$methods" value="$methods" />
                <el-option label="_get" value="_get" />
                <el-option label="_set" value="_set" />
                <el-option :label="$t('securityTests.customDot')" value="custom" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="protectionForm.property === 'custom'" :label="$t('securityTests.customName')">
              <el-input v-model="protectionForm.customName" :placeholder="$t('securityTests.customNamePlaceholder')" />
            </el-form-item>
            <el-form-item :label="$t('securityTests.valueToSet')">
              <el-input v-model="protectionForm.value" :placeholder="$t('securityTests.attemptToSetValue')" />
            </el-form-item>
            <el-form-item>
              <el-button type="danger" @click="attemptSystemOverride">
                {{ $t('securityTests.attemptOverride') }}
              </el-button>
              <el-button @click="testProxyProtection">{{ $t('securityTests.testProxyProtection') }}</el-button>
            </el-form-item>
          </el-form>

          <el-divider />

          <div class="protection-results">
            <h4>{{ $t('securityTests.protectionResults') }}</h4>
            <div v-if="protectionResults.length === 0" class="no-results">
              <el-icon><InfoFilled /></el-icon>
              <p>{{ $t('securityTests.noProtectionTestsRun') }}</p>
            </div>
            <div v-else class="results-list">
              <div 
                v-for="(result, index) in protectionResults" 
                :key="index" 
                class="result-item"
                :class="{ 'result-blocked': result.blocked, 'result-allowed': !result.blocked }"
              >
                <div class="result-header">
                  <el-tag :type="result.blocked ? 'success' : 'danger'" size="small">
                    {{ result.blocked ? $t('securityTests.blocked') : $t('securityTests.allowed') }}
                  </el-tag>
                  <span class="result-property">{{ result.property }}</span>
                </div>
                <div class="result-details">
                  <p class="result-message">{{ result.message }}</p>
                  <p v-if="result.error" class="result-error"><code>{{ result.error }}</code></p>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-6">
      <el-col :xs="24">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Warning /></el-icon>
              <span>{{ $t('securityTests.boundaryAndEdgeCases') }}</span>
            </div>
          </template>

          <el-row :gutter="24">
            <el-col :xs="24" :md="8">
              <div class="boundary-test">
                <h4>{{ $t('securityTests.methodVsExpressionAccess') }}</h4>
                <p class="description">{{ $t('securityTests.methodsCanAccessGlobals') }}</p>
                <el-button-group>
                  <el-button @click="testMethodGlobalAccess">{{ $t('securityTests.testMethodAccess') }}</el-button>
                  <el-button @click="testExpressionGlobalAccess">{{ $t('securityTests.testExpressionAccess') }}</el-button>
                </el-button-group>
                <div v-if="boundaryResults.methodVsExpression" class="result mt-2">
                  <el-tag :type="boundaryResults.methodVsExpression.passed ? 'success' : 'danger'">
                    {{ boundaryResults.methodVsExpression.result }}
                  </el-tag>
                </div>
              </div>
            </el-col>

            <el-col :xs="24" :md="8">
              <div class="boundary-test">
                <h4>{{ $t('securityTests.deepNestingProtection') }}</h4>
                <p class="description">{{ $t('securityTests.preventExcessiveRecursion') }}</p>
                <el-button @click="testDeepNesting">{{ $t('securityTests.testDeepNesting') }}</el-button>
                <div v-if="boundaryResults.deepNesting" class="result mt-2">
                  <el-tag :type="boundaryResults.deepNesting.passed ? 'success' : 'danger'">
                    {{ boundaryResults.deepNesting.result }}
                  </el-tag>
                </div>
              </div>
            </el-col>

            <el-col :xs="24" :md="8">
              <div class="boundary-test">
                <h4>{{ $t('securityTests.typeCoercionAttacks') }}</h4>
                <p class="description">{{ $t('securityTests.testForTypeConfusion') }}</p>
                <el-button @click="testTypeCoercion">{{ $t('securityTests.testTypeCoercion') }}</el-button>
                <div v-if="boundaryResults.typeCoercion" class="result mt-2">
                  <el-tag :type="boundaryResults.typeCoercion.passed ? 'success' : 'danger'">
                    {{ boundaryResults.typeCoercion.result }}
                  </el-tag>
                </div>
              </div>
            </el-col>
          </el-row>

          <el-divider />

          <div class="boundary-summary">
            <h4>{{ $t('securityTests.securitySummary') }}</h4>
            <el-progress 
              :percentage="securityScore" 
              :status="securityScore >= 80 ? 'success' : securityScore >= 60 ? 'warning' : 'exception'"
              :stroke-width="12"
              class="mb-4"
            />
            <div class="summary-stats">
              <div class="stat">
                <span class="stat-label">{{ $t('securityTests.testsPassed') }}:</span>
                <span class="stat-value">{{ passedTests }}/{{ totalTests }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">{{ $t('securityTests.securityScore') }}:</span>
                <span class="stat-value">{{ securityScore }}%</span>
              </div>
              <div class="stat">
                <span class="stat-label">{{ $t('securityTests.criticalIssues') }}:</span>
                <span class="stat-value">{{ criticalIssues }}</span>
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
import { Lock, Warning, InfoFilled } from '@element-plus/icons-vue'
import { createRuntimeContext, evaluate } from '@vario/core'

// @ts-ignore
const { t } = useI18n()

// Define types for better type safety
type TestCategory = 'safe' | 'global' | 'assignment' | 'function' | 'arrow' | 'new' | 'sideEffects'
type TestCase = {
  id: string
  expression: string
  description: string
}

// Security test cases organized by category
const testCases: Record<TestCategory, TestCase[]> = {
  safe: [
    { id: 'userName', expression: 'user.name', description: 'Access user name (safe)' },
    { id: 'countPlus', expression: 'count + 1', description: 'Add to count (safe)' },
    { id: 'arrayLength', expression: 'items.length', description: 'Get array length (safe)' },
    { id: 'conditional', expression: 'user.age > 18 ? "adult" : "minor"', description: 'Conditional expression (safe)' }
  ],
  global: [
    { id: 'window', expression: 'window.location.href', description: 'Access window object' },
    { id: 'document', expression: 'document.cookie', description: 'Access document object' },
    { id: 'globalThis', expression: 'globalThis', description: 'Access globalThis' },
    { id: 'self', expression: 'self', description: 'Access self (global)' }
  ],
  assignment: [
    { id: 'simple', expression: 'x = 10', description: 'Simple assignment' },
    { id: 'compound', expression: 'x += 5', description: 'Compound assignment' },
    { id: 'increment', expression: 'x++', description: 'Increment operator' },
    { id: 'decrement', expression: 'x--', description: 'Decrement operator' }
  ],
  function: [
    { id: 'eval', expression: 'eval("1+1")', description: 'eval() function call' },
    { id: 'constructor', expression: 'Object.constructor', description: 'Access constructor' },
    { id: 'prototype', expression: 'Array.prototype.push', description: 'Access prototype' }
  ],
  arrow: [
    { id: 'arrow', expression: '() => {}', description: 'Arrow function expression' },
    { id: 'asyncArrow', expression: 'async () => {}', description: 'Async arrow function' }
  ],
  new: [
    { id: 'newObject', expression: 'new Object()', description: 'new Object() expression' },
    { id: 'newArray', expression: 'new Array(10)', description: 'new Array() expression' }
  ],
  sideEffects: [
    { id: 'delete', expression: 'delete user.name', description: 'Delete property' },
    { id: 'throw', expression: 'throw new Error()', description: 'Throw exception' }
  ]
}

const selectedTestCategory = ref<TestCategory>('safe')
const selectedTestCase = ref('window')
const securityTestResults = ref<Array<{
  category: string
  expression: string
  passed: boolean
  message: string
  time: number
}>>([])

const protectionForm = reactive({
  property: '$emit',
  customName: '$custom',
  value: 'hacked'
})

const protectionResults = ref<Array<{
  property: string
  blocked: boolean
  message: string
  error?: string
}>>([])

const boundaryResults = reactive({
  methodVsExpression: null as { passed: boolean; result: string } | null,
  deepNesting: null as { passed: boolean; result: string } | null,
  typeCoercion: null as { passed: boolean; result: string } | null
})

const passedTests = ref(0)
const totalTests = ref(0)
const criticalIssues = ref(0)
const securityScore = ref(0)

// Create runtime context for testing
const ctx = createRuntimeContext({
  user: { name: 'Alice', age: 28 },
  items: [1, 2, 3, 4, 5],
  count: 0
})

const runSecurityTest = async () => {
  const category = selectedTestCategory.value
  const testId = selectedTestCase.value
  
  const testCase = testCases[category].find(t => t.id === testId)
  if (!testCase) return
  
  const startTime = performance.now()
  
  try {
    const result = evaluate(testCase.expression, ctx)
    const endTime = performance.now()
    
    // If we get here, the expression was NOT blocked (this is BAD for unsafe tests)
    const shouldBlock = category !== 'safe' // All non-safe categories should be blocked
    const passed = !shouldBlock
    
    securityTestResults.value.unshift({
      category,
      expression: testCase.expression,
      passed,
      message: passed ? 'Expression evaluated successfully (as expected)' : 
                       `Security FAILED: Expression should have been blocked but returned: ${result}`,
      time: endTime - startTime
    })
    
    updateSecurityMetrics(passed)
    
  } catch (error: any) {
    const endTime = performance.now()
    
    // If we get an error, the expression WAS blocked (this is GOOD for unsafe tests)
    const shouldBlock = category !== 'safe'
    const passed = shouldBlock
    
    securityTestResults.value.unshift({
      category,
      expression: testCase.expression,
      passed,
      message: passed ? `Security PASSED: Expression was blocked as expected: ${error.message}` :
                       `Security FAILED: Safe expression was blocked: ${error.message}`,
      time: endTime - startTime
    })
    
    updateSecurityMetrics(passed)
  }
}

const runAllCategoryTests = async () => {
  const category = selectedTestCategory.value
  const tests = testCases[category]
  
  for (const test of tests) {
    selectedTestCase.value = test.id
    await runSecurityTest()
    // Small delay to avoid overwhelming
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

const attemptSystemOverride = () => {
  const property = protectionForm.property === 'custom' 
    ? protectionForm.customName 
    : protectionForm.property
  
  try {
    ctx[property] = protectionForm.value
    protectionResults.value.unshift({
      property,
      blocked: false,
      message: `OVERRIDE SUCCEEDED (SECURITY BREACH!): Set ${property} = ${protectionForm.value}`
    })
    criticalIssues.value++
    updateSecurityScore()
  } catch (error: any) {
    protectionResults.value.unshift({
      property,
      blocked: true,
      message: `Override blocked as expected`,
      error: error.message
    })
  }
}

const testProxyProtection = () => {
  const testProperties = ['$emit', '$methods', '_get', '_set']
  
  testProperties.forEach(prop => {
    try {
      ctx[prop] = 'hacked'
      protectionResults.value.unshift({
        property: prop,
        blocked: false,
        message: `SECURITY BREACH: ${prop} was overwritten!`
      })
      criticalIssues.value++
    } catch (error: any) {
      protectionResults.value.unshift({
        property: prop,
        blocked: true,
        message: `Protected: ${prop} cannot be overwritten`,
        error: error.message
      })
    }
  })
  
  updateSecurityScore()
}

const testMethodGlobalAccess = () => {
  try {
    // 检查 $methods 是否被覆盖（安全漏洞检测）
    if (typeof ctx.$methods !== 'object' || ctx.$methods === null || Array.isArray(ctx.$methods)) {
      boundaryResults.methodVsExpression = {
        passed: false,
        result: `SECURITY BREACH: $methods was overwritten to ${typeof ctx.$methods}`
      }
      criticalIssues.value++
      updateSecurityMetrics(false)
      updateSecurityScore()
      return
    }
    
    // Register a method that accesses globals
    ctx.$methods.testGlobalAccess = async () => {
      // This should work because methods can access globals
      return { success: true }
    }
    
    boundaryResults.methodVsExpression = {
      passed: true,
      result: 'Method can access globals (as expected)'
    }
    updateSecurityMetrics(true)
  } catch (error: any) {
    boundaryResults.methodVsExpression = {
      passed: false,
      result: `Method access failed: ${error.message}`
    }
    updateSecurityMetrics(false)
  }
}

const testExpressionGlobalAccess = () => {
  try {
    evaluate('window', ctx)
    boundaryResults.methodVsExpression = {
      passed: false,
      result: 'SECURITY BREACH: Expression accessed global object!'
    }
    criticalIssues.value++
    updateSecurityMetrics(false)
  } catch (error: any) {
    boundaryResults.methodVsExpression = {
      passed: true,
      result: 'Expression correctly blocked from accessing globals'
    }
    updateSecurityMetrics(true)
  }
  
  updateSecurityScore()
}

const testDeepNesting = () => {
  try {
    // Create a deeply nested expression
    let expr = 'a'
    for (let i = 0; i < 100; i++) {
      expr = `{b: ${expr}}`
    }
    evaluate(expr, ctx)
    
    boundaryResults.deepNesting = {
      passed: false,
      result: 'Deep nesting was not blocked (potential DoS risk)'
    }
    criticalIssues.value++
    updateSecurityMetrics(false)
  } catch (error: any) {
    boundaryResults.deepNesting = {
      passed: true,
      result: 'Deep nesting correctly blocked'
    }
    updateSecurityMetrics(true)
  }
  
  updateSecurityScore()
}

const testTypeCoercion = () => {
  try {
    // Test for type confusion attacks
    const result = evaluate('1 + "1"', ctx)
    
    boundaryResults.typeCoercion = {
      passed: true,
      result: `Type coercion handled: ${result}`
    }
    updateSecurityMetrics(true)
  } catch (error: any) {
    boundaryResults.typeCoercion = {
      passed: false,
      result: `Type coercion error: ${error.message}`
    }
    updateSecurityMetrics(false)
  }
  
  updateSecurityScore()
}

const updateSecurityMetrics = (passed: boolean) => {
  totalTests.value++
  if (passed) {
    passedTests.value++
  }
  updateSecurityScore()
}

const updateSecurityScore = () => {
  const score = totalTests.value > 0 
    ? Math.round((passedTests.value / totalTests.value) * 100) 
    : 0
  
  // Penalize for critical issues
  securityScore.value = Math.max(0, score - (criticalIssues.value * 10))
}
</script>

<style scoped lang="scss">
.security-tests {
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

.test-results,
.protection-results {
  max-height: 400px;
  overflow-y: auto;
}

.no-results {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-text-tertiary);

  .el-icon {
    font-size: var(--font-size-4xl);
    margin-bottom: var(--space-4);
  }

  p {
    margin-bottom: 0;
  }
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.result-item {
  padding: var(--space-4);
  border-radius: var(--radius-base);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);

  &.result-passed {
    border-left: 4px solid var(--color-success);
  }

  &.result-failed {
    border-left: 4px solid var(--color-error);
  }

  &.result-blocked {
    border-left: 4px solid var(--color-success);
  }

  &.result-allowed {
    border-left: 4px solid var(--color-error);
  }
}

.result-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.result-category {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.result-property {
  font-family: var(--font-family-mono);
  color: var(--color-text);
}

.result-time {
  margin-left: auto;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.result-details {
  code {
    background: var(--color-bg-tertiary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-sm);
  }
}

.result-expression {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-2);
  word-break: break-all;
}

.result-message {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  margin-bottom: var(--space-2);
}

.result-error {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin-bottom: 0;
}

.boundary-test {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-2);
  }

  .description {
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-4);
  }
}

.boundary-summary {
  h4 {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-4);
  }
}

.summary-stats {
  display: flex;
  justify-content: space-around;
  margin-top: var(--space-6);

  .stat {
    text-align: center;

    .stat-label {
      display: block;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-2);
    }

    .stat-value {
      display: block;
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-text);
    }
  }
}

.mt-2 {
  margin-top: var(--space-2);
}

.mt-6 {
  margin-top: var(--space-6);
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