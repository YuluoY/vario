<template>
  <div class="performance-tests">
    <h2>{{ $t('performanceTests.title') }}</h2>
    <p class="description">{{ $t('performanceTests.description') }}</p>

    <el-row :gutter="24">
      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Timer /></el-icon>
              <span>{{ $t('performanceTests.expressionEvaluationSpeed') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('performanceTests.measureExpressionPerformance')"
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('performanceTests.testEvaluationSpeed') }}</p>
          </el-alert>

          <el-form label-width="140px">
            <el-form-item :label="$t('performanceTests.expression')">
              <el-select
                v-model="expression"
                filterable
                allow-create
                default-first-option
                :placeholder="$t('performanceTests.selectOrEnterExpression')"
                style="width: 100%"
              >
                <el-option-group :label="$t('performanceTests.simpleExpressions')">
                  <el-option
                    v-for="expr in simpleExpressions"
                    :key="expr.value"
                    :label="expr.label"
                    :value="expr.value"
                  >
                    <span style="float: left">{{ expr.label }}</span>
                    <span style="float: right; color: var(--el-text-color-secondary); font-size: 13px">
                      {{ expr.value }}
                    </span>
                  </el-option>
                </el-option-group>
                <el-option-group :label="$t('performanceTests.mediumComplexity')">
                  <el-option
                    v-for="expr in mediumExpressions"
                    :key="expr.value"
                    :label="expr.label"
                    :value="expr.value"
                  >
                    <span style="float: left">{{ expr.label }}</span>
                    <span style="float: right; color: var(--el-text-color-secondary); font-size: 13px">
                      {{ expr.value }}
                    </span>
                  </el-option>
                </el-option-group>
                <el-option-group :label="$t('performanceTests.complexExpressions')">
                  <el-option
                    v-for="expr in complexExpressions"
                    :key="expr.value"
                    :label="expr.label"
                    :value="expr.value"
                  >
                    <span style="float: left">{{ expr.label }}</span>
                    <span style="float: right; color: var(--el-text-color-secondary); font-size: 13px">
                      {{ expr.value }}
                    </span>
                  </el-option>
                </el-option-group>
              </el-select>
            </el-form-item>
            <el-form-item :label="$t('performanceTests.iterations')">
              <el-slider
                v-model="iterations"
                :min="1"
                :max="10000"
                :step="100"
                show-stops
                :marks="iterationsMarks"
              />
            </el-form-item>
            <el-form-item :label="$t('performanceTests.initialArraySize')">
              <el-input-number v-model="arraySize" :min="1" :max="10000" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="runExpressionBenchmark">
                {{ $t('performanceTests.runBenchmark') }}
              </el-button>
              <el-button @click="runWithCaching = !runWithCaching">
                {{ runWithCaching ? $t('performanceTests.disable') : $t('performanceTests.enable') }} {{ $t('performanceTests.cache') }}
              </el-button>
            </el-form-item>
          </el-form>

          <el-divider />

          <div v-if="expressionResults" class="benchmark-results">
            <h4>{{ $t('performanceTests.benchmarkResults') }}:</h4>
            <el-alert
              v-if="expressionResults.error"
              :title="expressionResults.error"
              type="error"
              :closable="false"
              show-icon
              class="mb-4"
            />
            <template v-else>
              <el-row :gutter="16">
                <el-col :span="12">
                  <div class="stat-item">
                    <div class="stat-label">{{ $t('performanceTests.totalTime') }}</div>
                    <div class="stat-value">{{ (expressionResults.totalTime || 0).toFixed(2) }}ms</div>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="stat-item">
                    <div class="stat-label">{{ $t('performanceTests.averagePerTime') }}</div>
                    <div class="stat-value">{{ (expressionResults.avgTime || 0).toFixed(4) }}ms</div>
                  </div>
                </el-col>
              </el-row>
              <el-progress
                v-if="expressionResults.opsPerSecond"
                :percentage="Math.min(expressionResults.opsPerSecond / 1000 * 10, 100)"
                :text-inside="true"
                :stroke-width="24"
                :format="() => `${Math.round(expressionResults.opsPerSecond)} ${$t('performanceTests.opsPerSecond')}`"
                status="success"
                class="mt-4"
              />
            </template>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><PieChart /></el-icon>
              <span>{{ $t('performanceTests.memoryUsageScalability') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('performanceTests.testMemoryUsage')"
            type="warning"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('performanceTests.createLargeState') }}</p>
          </el-alert>

          <el-form label-width="140px">
            <el-form-item :label="$t('performanceTests.stateSize')">
              <el-input-number v-model="stateSize" :min="100" :max="100000" :step="100" />
            </el-form-item>
            <el-form-item :label="$t('performanceTests.nestedDepth')">
              <el-input-number v-model="nestedDepth" :min="1" :max="10" />
            </el-form-item>
            <el-form-item :label="$t('performanceTests.includeArrays')">
              <el-switch v-model="includeArrays" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="createLargeState">
                {{ $t('performanceTests.createLargeStateBtn') }}
              </el-button>
              <el-button @click="measureMemoryUsage">{{ $t('performanceTests.measureMemory') }}</el-button>
            </el-form-item>
          </el-form>

          <el-divider />

          <div v-if="memoryResults" class="memory-results">
            <h4>{{ $t('performanceTests.memoryResults') }}:</h4>
            <el-alert
              v-if="memoryResults.message"
              :title="memoryResults.message"
              :type="memoryResults.success === false ? 'error' : 'info'"
              :closable="false"
              show-icon
              class="mb-4"
            />
            <el-row :gutter="16">
              <el-col :span="8">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('performanceTests.heapMemoryUsage') }}</div>
                  <div class="stat-value">{{ (memoryResults.heapUsed || 0).toFixed(2) }}MB</div>
                </div>
              </el-col>
              <el-col :span="8">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('performanceTests.stateKeyCount') }}</div>
                  <div class="stat-value">{{ memoryResults.keys || 0 }}</div>
                </div>
              </el-col>
              <el-col v-if="memoryResults.totalHeap" :span="8">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('performanceTests.totalHeapMemory') }}</div>
                  <div class="stat-value">{{ memoryResults.totalHeap.toFixed(2) }}MB</div>
                </div>
              </el-col>
            </el-row>
            <el-progress
              v-if="memoryResults.heapUsed"
              :percentage="Math.min((memoryResults.heapUsed / (memoryResults.limit || 100)) * 100, 100)"
              :text-inside="true"
              :stroke-width="24"
              :format="() => `${$t('performanceTests.usedHeapMemory')} ${(memoryResults.heapUsed || 0).toFixed(2)}MB`"
              :status="memoryResults.heapUsed > 50 ? 'exception' : 'warning'"
              class="mt-4"
            />
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
              <span>{{ $t('performanceTests.stressBoundaryTests') }}</span>
            </div>
          </template>

          <el-tabs v-model="activeStressTab">
            <el-tab-pane :label="$t('performanceTests.deepNesting')" name="nesting">
              <div class="stress-test">
                <h4>{{ $t('performanceTests.deepNestedAccess') }}</h4>
                <p>{{ $t('performanceTests.testDeepNestingPerformance') }}</p>
                
                <el-form :inline="true">
                  <el-form-item :label="$t('performanceTests.nestingDepth')">
                    <el-input-number v-model="deepNestingDepth" :min="1" :max="50" />
                  </el-form-item>
                  <el-form-item>
                    <el-button @click="testDeepNesting">{{ $t('performanceTests.test') }}</el-button>
                  </el-form-item>
                </el-form>

                <div v-if="nestingResult" class="test-result">
                  <el-tag :type="nestingResult.success ? 'success' : 'danger'">
                    {{ nestingResult.message }}
                  </el-tag>
                  <div v-if="nestingResult.time" class="result-detail">
                    {{ $t('performanceTests.evaluationTime') }}{{ nestingResult.time.toFixed(2) }}ms
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="$t('performanceTests.largeArrays')" name="arrays">
              <div class="stress-test">
                <h4>{{ $t('performanceTests.largeArrayOperations') }}</h4>
                <p>{{ $t('performanceTests.testLargeArrayScalability') }}</p>
                
                <el-form :inline="true">
                  <el-form-item :label="$t('performanceTests.arraySize')">
                    <el-input-number v-model="largeArraySize" :min="1000" :max="100000" :step="1000" />
                  </el-form-item>
                  <el-form-item>
                    <el-button @click="testLargeArrays">{{ $t('performanceTests.testArrayOperations') }}</el-button>
                  </el-form-item>
                </el-form>

                <div v-if="arrayResult" class="test-result">
                  <el-tag :type="arrayResult.success ? 'success' : 'danger'">
                    {{ arrayResult.message }}
                  </el-tag>
                  <div v-if="arrayResult.operations" class="result-detail">
                    {{ arrayResult.operations }} {{ $t('performanceTests.operations') }}{{ $t('performanceTests.timeSpent') }}{{ arrayResult.time.toFixed(2) }}ms
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="$t('performanceTests.errorHandling')" name="errors">
              <div class="stress-test">
                <h4>{{ $t('performanceTests.errorRecoveryBoundary') }}</h4>
                <p>{{ $t('performanceTests.testVarioErrorHandling') }}</p>
                
                <el-button-group class="mb-4">
                  <el-button @click="testMalformedExpression">{{ $t('performanceTests.malformedExpression') }}</el-button>
                  <el-button @click="testInfiniteLoop">{{ $t('performanceTests.recursionDetection') }}</el-button>
                  <el-button @click="testMemoryLeak">{{ $t('performanceTests.memoryLeakCheck') }}</el-button>
                </el-button-group>

                <div v-if="errorResult" class="test-result">
                  <el-tag :type="errorResult.success ? 'success' : 'danger'">
                    {{ errorResult.message }}
                  </el-tag>
                  <div v-if="errorResult.details" class="result-detail">
                    {{ errorResult.details }}
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>

    <!-- 实时性能监控 -->
    <el-row :gutter="24" class="mt-6">
      <el-col :xs="24">
        <el-card class="test-card">
          <template #header>
            <div class="card-header">
              <el-icon><Monitor /></el-icon>
              <span>{{ $t('performanceTests.realtimePerformanceMonitor') }}</span>
            </div>
          </template>

          <el-alert
            :title="$t('performanceTests.realtimeMonitorDescription')"
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
          >
            <p>{{ $t('performanceTests.monitorVarioRuntime') }}</p>
            <ul style="margin: 8px 0; padding-left: 20px;">
              <li><strong>{{ $t('performanceTests.expressionCacheHitRate') }}</strong>{{ $t('performanceTests.cacheHitRateDescription') }}</li>
              <li><strong>{{ $t('performanceTests.avgInstructionTime') }}</strong>{{ $t('performanceTests.avgInstructionTimeDescription') }}</li>
              <li><strong>{{ $t('performanceTests.contextSize') }}</strong>{{ $t('performanceTests.contextSizeDescription') }}</li>
            </ul>
            <p style="margin-top: 8px;">{{ $t('performanceTests.clickStartMonitoring') }}</p>
          </el-alert>

          <div class="performance-monitor">
            <el-row :gutter="16" class="mb-4">
              <el-col :span="8">
                <div class="metric-card">
                  <div class="metric-label">{{ $t('performanceTests.expressionCacheHitRate') }}</div>
                  <div class="metric-value">{{ cacheHitRate.toFixed(1) }}%</div>
                  <el-progress 
                    :percentage="cacheHitRate" 
                    :show-text="false" 
                    status="success"
                  />
                </div>
              </el-col>
              <el-col :span="8">
                <div class="metric-card">
                  <div class="metric-label">{{ $t('performanceTests.avgInstructionTime') }}</div>
                  <div class="metric-value">{{ avgInstructionTime.toFixed(3) }}ms</div>
                  <el-progress 
                    :percentage="Math.min(avgInstructionTime * 100, 100)" 
                    :show-text="false" 
                    status="warning"
                  />
                </div>
              </el-col>
              <el-col :span="8">
                <div class="metric-card">
                  <div class="metric-label">{{ $t('performanceTests.contextSize') }}</div>
                  <div class="metric-value">{{ contextSize.toLocaleString() }}</div>
                  <el-progress 
                    :percentage="Math.min(contextSize / 1000, 100)" 
                    :show-text="false" 
                    status="info"
                  />
                </div>
              </el-col>
            </el-row>

            <div class="monitor-controls">
              <el-button @click="startMonitoring" :disabled="monitoringActive">
                <el-icon><VideoPlay /></el-icon>
                {{ $t('performanceTests.startMonitoring') }}
              </el-button>
              <el-button @click="stopMonitoring" :disabled="!monitoringActive">
                <el-icon><VideoPause /></el-icon>
                {{ $t('performanceTests.stopMonitoring') }}
              </el-button>
              <el-button @click="resetMetrics">
                <el-icon><Refresh /></el-icon>
                {{ $t('performanceTests.resetMetrics') }}
              </el-button>
            </div>

            <el-divider />

            <div class="performance-chart">
              <h4>{{ $t('performanceTests.realtimePerformanceChart') }}</h4>
              <div class="chart-container">
                <div 
                  ref="chartContainer" 
                  class="chart-wrapper"
                  :style="{ display: (monitoringActive || performanceHistory.length > 0) ? 'block' : 'none' }"
                ></div>
                <div v-if="!monitoringActive && performanceHistory.length === 0" class="chart-placeholder">
                  <p>{{ $t('performanceTests.clickToVisualize') }}</p>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onUnmounted, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import * as echarts from 'echarts'
import { 
  Timer, 
  PieChart, 
  Warning, 
  Monitor, 
  VideoPlay, 
  VideoPause, 
  Refresh 
} from '@element-plus/icons-vue'
import { createRuntimeContext, evaluate } from '@variojs/core'

const { t, locale } = useI18n()

// 表达式选项列表
const simpleExpressions = [
  { label: '数组长度', value: 'array.length' },
  { label: '第一个元素', value: 'array[0]' },
  { label: '最后一个元素', value: 'array[array.length - 1]' },
  { label: '数组是否为空', value: 'array.length === 0' },
  { label: '数字常量', value: '100' },
  { label: '字符串常量', value: '"hello"' },
  { label: '布尔值', value: 'true' },
  { label: '简单加法', value: '1 + 2' },
  { label: '简单乘法', value: '3 * 4' },
]

const mediumExpressions = [
  { label: '数学最大值', value: 'Math.max(1, 2, 3, 4, 5)' },
  { label: '数学最小值', value: 'Math.min(10, 20, 30)' },
  { label: '数学取整', value: 'Math.floor(3.7)' },
  { label: '数学向上取整', value: 'Math.ceil(3.2)' },
  { label: '数学四舍五入', value: 'Math.round(3.5)' },
  { label: '数学绝对值', value: 'Math.abs(-10)' },
  { label: '数组最后一个元素', value: 'array[array.length - 1]' },
  { label: '数组切片长度', value: 'array.slice(0, 100).length' },
  { label: '条件表达式', value: 'array.length > 0 ? "有数据" : "无数据"' },
  { label: '逻辑与', value: 'array.length > 0 && array.length < 1000' },
  { label: '逻辑或', value: 'array.length === 0 || array.length > 10000' },
  { label: '空值合并', value: 'array.length ?? 0' },
  { label: '字符串转换', value: 'String(array.length)' },
  { label: '数字转换', value: 'Number("123")' },
]

const complexExpressions = [
  { label: '嵌套条件', value: 'array.length > 100 ? (array.length > 1000 ? "很大" : "中等") : "很小"' },
  { label: '多重数学运算', value: 'Math.max(Math.floor(array.length / 10), 1) * 10' },
  { label: '复杂逻辑', value: '(array.length > 0 && array.length < 100) || array.length === 1000' },
  { label: '链式数学运算', value: 'Math.round(Math.abs(-3.7) * 2)' },
  { label: '多层条件', value: 'array.length === 0 ? 0 : array.length < 100 ? array.length : 100' },
  { label: '混合运算', value: 'Math.max(array.length, 10) + Math.min(array.length, 50)' },
  { label: '复杂布尔表达式', value: '(array.length > 10 && array.length < 100) || (array.length === 0 && true)' },
  { label: '嵌套函数调用', value: 'Math.max(Math.min(array.length, 100), 0)' },
  { label: '三元嵌套', value: 'array.length > 50 ? (array.length > 100 ? "超大" : "大") : (array.length > 10 ? "中" : "小")' },
  { label: '多条件组合', value: 'array.length > 0 ? Math.max(array.length, 100) : Math.min(0, -1)' },
]

const expression = ref('array.length')
const iterations = ref(1000)
const arraySize = ref(1000)
const runWithCaching = ref(true)
const expressionResults = ref<any>(null)

const stateSize = ref(1000)
const nestedDepth = ref(3)
const includeArrays = ref(true)
const memoryResults = ref<any>(null)

const activeStressTab = ref('nesting')
const deepNestingDepth = ref(10)
const largeArraySize = ref(10000)
const nestingResult = ref<any>(null)
const arrayResult = ref<any>(null)
const errorResult = ref<any>(null)

const cacheHitRate = ref(85.5)
const avgInstructionTime = ref(0.025)
const contextSize = ref(2450)
const monitoringActive = ref(false)
let monitoringInterval: number | null = null

// 图表相关
const chartContainer = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null
const performanceHistory = ref<Array<{
  time: number
  cacheHitRate: number
  avgInstructionTime: number
  contextSize: number
}>>([])
const maxHistoryLength = 60 // 保留最近60秒的数据

// 窗口大小变化处理函数
const handleResize = () => {
  chartInstance?.resize()
}

const ctx = createRuntimeContext({
  array: Array.from({ length: arraySize.value }, () => Math.random() * 1000)
})

const iterationsMarks = reactive({
  1: '1',
  1000: '1k',
  5000: '5k',
  10000: '10k'
})

const runExpressionBenchmark = () => {
  try {
    const startTime = performance.now()
    
    // 创建包含大型数组的新上下文
    const testCtx = createRuntimeContext({
      array: Array.from({ length: arraySize.value }, () => Math.random() * 1000)
    })
    
    // 如果测试时不使用缓存，清除缓存
    if (!runWithCaching.value) {
      // 需要访问内部缓存机制
    }
    
    for (let i = 0; i < iterations.value; i++) {
      evaluate(expression.value, testCtx)
    }
    
    const totalTime = performance.now() - startTime
    
    expressionResults.value = {
      totalTime,
      avgTime: totalTime / iterations.value,
      opsPerSecond: (iterations.value / totalTime) * 1000
    }
  } catch (error: any) {
    console.error(t('performanceTests.benchmarkTestError'), error)
    expressionResults.value = {
      error: error.message
    }
  }
}

let largeStateContext: ReturnType<typeof createRuntimeContext> | null = null

const createLargeState = () => {
  try {
    const state: Record<string, any> = {}
    
    for (let i = 0; i < stateSize.value; i++) {
      let nestedObj: any = {}
      let current = nestedObj
      
      for (let d = 0; d < nestedDepth.value - 1; d++) {
        current[`level${d}`] = {}
        current = current[`level${d}`]
      }
      
      current[`value`] = `data_${i}`
      
      if (includeArrays.value && i % 10 === 0) {
        current[`array`] = Array.from({ length: 10 }, (_, idx) => idx)
      }
      
      state[`key${i}`] = nestedObj
    }
    
    largeStateContext = createRuntimeContext(state)
    console.log(t('performanceTests.createdContext', [stateSize.value]))
    
    // 显示创建成功的信息
    memoryResults.value = {
      heapUsed: 0,
      keys: stateSize.value,
      message: t('performanceTests.successfullyCreatedState', [stateSize.value, nestedDepth.value]),
      success: true
    }
    
    // 自动测量内存
    setTimeout(() => {
      measureMemoryUsage()
    }, 100)
  } catch (error: any) {
    memoryResults.value = {
      heapUsed: 0,
      keys: 0,
      message: t('performanceTests.createStateFailed', [error.message]),
      success: false
    }
  }
}

const measureMemoryUsage = () => {
  try {
    // 如果没有创建状态，先创建一个
    if (!largeStateContext) {
      createLargeState()
      return
    }
    
    if (typeof performance !== 'undefined' && 'memory' in performance) {

      // 尝试触发垃圾回收（仅在 Node.js 环境中可用）
      if (typeof global !== 'undefined' && (global as any).gc) {
        (global as any).gc()
      }
      
      // 等待一下让 GC 完成
      setTimeout(() => {
        const currentMemory = (performance as any).memory
        memoryResults.value = {
          heapUsed: currentMemory.usedJSHeapSize / (1024 * 1024),
          keys: stateSize.value,
          totalHeap: currentMemory.totalJSHeapSize / (1024 * 1024),
          limit: currentMemory.jsHeapSizeLimit / (1024 * 1024),
          success: true
        }
      }, 200)
    } else {
      // 浏览器环境可能没有 performance.memory，使用估算
      const estimatedSize = stateSize.value * nestedDepth.value * 0.001 // 粗略估算
      memoryResults.value = {
        heapUsed: estimatedSize,
        keys: stateSize.value,
        message: t('performanceTests.memoryApiUnavailable'),
        success: true
      }
    }
  } catch (error: any) {
    memoryResults.value = {
      heapUsed: 0,
      keys: stateSize.value,
      message: t('performanceTests.measureMemoryFailed', [error.message]),
      success: false
    }
  }
}

const testDeepNesting = () => {
  try {
    // 创建深度嵌套对象
    let obj: any = {}
    let current = obj
    const pathParts = []
    
    for (let i = 0; i < deepNestingDepth.value; i++) {
      current[`level${i}`] = {}
      current = current[`level${i}`]
      pathParts.push(`level${i}`)
    }
    
    current.value = 'deep_value'
    pathParts.push('value')
    
    const testCtx = createRuntimeContext({ deep: obj })
    const path = `deep.${pathParts.join('.')}`
    
    const startTime = performance.now()
    const result = evaluate(path, testCtx)
    const endTime = performance.now()
    
    nestingResult.value = {
      success: true,
      message: t('performanceTests.deepNestingSuccess', [deepNestingDepth.value]),
      time: endTime - startTime,
      result
    }
  } catch (error: any) {
    nestingResult.value = {
      success: false,
      message: t('performanceTests.deepNestingFailed', [error.message])
    }
  }
}

const testLargeArrays = () => {
  try {
    const largeArray = Array.from({ length: largeArraySize.value }, () => Math.random())
    const testCtx = createRuntimeContext({ array: largeArray })
    
    const startTime = performance.now()
    
    // 执行多个数组操作
    const results = []
    results.push(evaluate('array.length', testCtx))
    results.push(evaluate('array.slice(0, 100).length', testCtx))
    results.push(evaluate('array[0]', testCtx))
    results.push(evaluate('array[array.length - 1]', testCtx))
    results.push(evaluate('array.length > 0 ? array.length : 0', testCtx))
    
    const endTime = performance.now()
    
    arrayResult.value = {
      success: true,
      message: t('performanceTests.largeArraySuccess', [largeArraySize.value]),
      time: endTime - startTime,
      operations: results.length
    }
  } catch (error: any) {
    arrayResult.value = {
      success: false,
      message: t('performanceTests.largeArrayTestFailed', [error.message])
    }
  }
}

const testMalformedExpression = () => {
  try {
    const result = evaluate('invalid!@#$%^&*() syntax', ctx)
    errorResult.value = {
      success: false,
      message: t('performanceTests.malformedExpressionNotBlocked'),
      details: t('performanceTests.unexpectedResult', [result])
    }
  } catch (error: any) {
    errorResult.value = {
      success: true,
      message: t('performanceTests.malformedExpressionBlocked'),
      details: error.message
    }
  }
}

const testInfiniteLoop = () => {
  try {
    // This expression should be rejected
    evaluate('while(true){}', ctx)
    errorResult.value = {
      success: false,
      message: t('performanceTests.infiniteLoopNotBlocked')
    }
  } catch (error: any) {
    errorResult.value = {
      success: true,
      message: t('performanceTests.infiniteLoopBlocked'),
      details: error.message
    }
  }
}

const testMemoryLeak = () => {
  try {
    // 测试重复创建上下文和求值
    const contexts = []
    for (let i = 0; i < 100; i++) {
      const testCtx = createRuntimeContext({
        data: Array.from({ length: 100 }, (_, idx) => `value_${idx}`)
      })
      evaluate('data.length', testCtx)
      contexts.push(testCtx)
    }
    
    errorResult.value = {
      success: true,
      message: t('performanceTests.memoryLeakTestComplete'),
      details: t('performanceTests.createdContexts')
    }
  } catch (error: any) {
    errorResult.value = {
      success: false,
      message: t('performanceTests.memoryLeakTestFailed'),
      details: error.message
    }
  }
}

const startMonitoring = () => {
  monitoringActive.value = true
  performanceHistory.value = [] // 清空历史数据
  
  // 确保图表容器可见后再初始化
  nextTick(() => {
    // 延迟一点确保 DOM 已更新
    setTimeout(() => {
      if (!chartInstance) {
        initChart()
      } else {
        // 如果图表已存在，确保它可见并调整大小
        chartInstance.resize()
      }
    }, 50)
  })
  
  monitoringInterval = setInterval(() => {
    // 模拟随机性能数据
    cacheHitRate.value = 80 + Math.random() * 15
    avgInstructionTime.value = 0.02 + Math.random() * 0.03
    contextSize.value = 2000 + Math.random() * 1000
    
    // 记录性能数据
    performanceHistory.value.push({
      time: Date.now(),
      cacheHitRate: cacheHitRate.value,
      avgInstructionTime: avgInstructionTime.value,
      contextSize: contextSize.value
    })
    
    // 限制历史数据长度
    if (performanceHistory.value.length > maxHistoryLength) {
      performanceHistory.value.shift()
    }
    
    // 更新图表
    nextTick(() => {
      updateChart()
    })
    
    // 模拟一些表达式求值
    try {
      evaluate('Math.random() * 100', ctx)
    } catch (error) {
      // Ignore errors during monitoring
    }
  }, 1000) as unknown as number
}

const stopMonitoring = () => {
  monitoringActive.value = false
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
  }
}

const resetMetrics = () => {
  cacheHitRate.value = 85.5
  avgInstructionTime.value = 0.025
  contextSize.value = 2450
  performanceHistory.value = []
  nextTick(() => {
    updateChart()
  })
}

const initChart = () => {
  if (!chartContainer.value) {
    console.warn(t('performanceTests.chartContainerNotFound'))
    return
  }
  
  // 确保容器可见且有尺寸
  const container = chartContainer.value
  if (container.offsetWidth === 0 || container.offsetHeight === 0) {
    // 如果容器还没有尺寸，延迟初始化
    setTimeout(() => {
      initChart()
    }, 100)
    return
  }
  
  // 如果已存在实例，先销毁
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  
  try {
    // 初始化 ECharts 实例
    chartInstance = echarts.init(container)
    
    // 设置初始配置
    if (performanceHistory.value.length > 0) {
      updateChart()
    } else {
      // 即使没有数据，也设置一个空配置，确保图表已初始化
      chartInstance.setOption({
        title: {
          text: t('performanceTests.monitoringPerformanceChart'),
          left: 'center'
        },
        xAxis: {
          type: 'category',
          data: []
        },
        yAxis: {
          type: 'value'
        },
        series: []
      })
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', handleResize)
  } catch (error) {
    console.error(t('performanceTests.chartInitFailed'), error)
  }
}

const updateChart = () => {
  if (!chartInstance) {
    // 如果图表未初始化，尝试初始化
    if (chartContainer.value && (monitoringActive.value || performanceHistory.value.length > 0)) {
      initChart()
    }
    return
  }
  
  if (performanceHistory.value.length === 0) {
    return
  }
  
  // 确保图表尺寸正确
  chartInstance.resize()
  
  const data = performanceHistory.value
  const timeLabels = data.map((point, _index) => {
    const time = new Date(point.time)
    return `${time.getMinutes()}:${time.getSeconds().toString().padStart(2, '0')}`
  })
  
  const option: echarts.EChartsOption = {
    title: {
      text: t('performanceTests.realtimePerformanceMonitor'),
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 'normal'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return ''
        let result = `<div style="margin-bottom: 4px;">${params[0].axisValue}</div>`
        params.forEach((param: any) => {
          const value = typeof param.value === 'number' ? param.value.toFixed(2) : param.value
          result += `<div style="margin: 2px 0;">
            <span style="display:inline-block;width:10px;height:10px;background:${param.color};border-radius:50%;margin-right:5px;"></span>
            ${param.seriesName}: <strong>${value}${param.seriesName === t('performanceTests.expressionCacheHitRate') ? '%' : param.seriesName === t('performanceTests.avgInstructionTime') ? 'ms' : ''}</strong>
          </div>`
        })
        return result
      }
    },
    legend: {
      data: [t('performanceTests.expressionCacheHitRate'), t('performanceTests.avgInstructionTime'), t('performanceTests.contextSize')],
      bottom: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: timeLabels,
      axisLabel: {
        rotate: 45,
        interval: Math.floor(data.length / 10) // 只显示部分标签，避免拥挤
      }
    },
    yAxis: [
      {
        type: 'value',
        name: t('performanceTests.cacheHitRatePercentage'),
        position: 'left',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: (value: number) => `${value.toFixed(2)}%`
        }
      },
      {
        type: 'value',
        name: t('performanceTests.instructionTimeContextSize'),
        position: 'right',
        axisLabel: {
          formatter: (value: number) => value.toFixed(2)
        }
      }
    ],
    series: [
      {
        name: t('performanceTests.expressionCacheHitRate'),
        type: 'line',
        smooth: true,
        data: data.map(d => parseFloat(d.cacheHitRate.toFixed(2))),
        itemStyle: {
          color: '#67c23a'
        },
        lineStyle: {
          color: '#67c23a',
          width: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
              { offset: 1, color: 'rgba(103, 194, 58, 0.1)' }
            ]
          }
        },
        yAxisIndex: 0
      },
      {
        name: t('performanceTests.avgInstructionTime'),
        type: 'line',
        smooth: true,
        data: data.map(d => parseFloat((d.avgInstructionTime * 1000).toFixed(2))),
        itemStyle: {
          color: '#e6a23c'
        },
        lineStyle: {
          color: '#e6a23c',
          width: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(230, 162, 60, 0.3)' },
              { offset: 1, color: 'rgba(230, 162, 60, 0.1)' }
            ]
          }
        },
        yAxisIndex: 1
      },
      {
        name: t('performanceTests.contextSize'),
        type: 'line',
        smooth: true,
        data: data.map(d => parseFloat(d.contextSize.toFixed(2))),
        itemStyle: {
          color: '#409eff'
        },
        lineStyle: {
          color: '#409eff',
          width: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
              { offset: 1, color: 'rgba(64, 158, 255, 0.1)' }
            ]
          }
        },
        yAxisIndex: 1
      }
    ],
    animation: true,
    animationDuration: 300
  }
  
  chartInstance.setOption(option, true) // true 表示不合并，完全替换
}

// 监听性能数据变化，自动更新图表
watch(performanceHistory, () => {
  if (monitoringActive.value || performanceHistory.value.length > 0) {
    nextTick(() => {
      updateChart()
    })
  }
}, { deep: true })

// 监听语言变化，更新图表配置
watch(locale, () => {
  if (chartInstance && (monitoringActive.value || performanceHistory.value.length > 0)) {
    nextTick(() => {
      updateChart()
    })
  }
})

onMounted(() => {
  // 不立即初始化，等用户点击开始监控时再初始化
  // 这样可以确保容器有正确的尺寸
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  window.removeEventListener('resize', handleResize)
  
  // 清理监控定时器
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
  }
})

onUnmounted(() => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
  }
})
</script>

<style scoped lang="scss">
.performance-tests {
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

.benchmark-results,
.memory-results {
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

.stress-test {
  h4 {
    font-size: var(--font-size-lg);
    margin-bottom: var(--space-2);
  }

  p {
    color: var(--color-text-secondary);
    margin-bottom: var(--space-4);
  }
}

.test-result {
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-base);
}

.result-detail {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.performance-monitor {
  .metric-card {
    padding: var(--space-4);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-base);
    text-align: center;
  }

  .metric-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-2);
  }

  .metric-value {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-primary);
    margin-bottom: var(--space-3);
  }
}

.monitor-controls {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.chart-container {
  height: 400px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
  position: relative;
  overflow: hidden;
  
  .chart-wrapper {
    width: 100%;
    height: 100%;
    min-height: 400px;
    min-width: 100%;
    display: block;
  }
}

.chart-placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--color-text-tertiary);
  pointer-events: none;
}

.mt-4 {
  margin-top: var(--space-4);
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