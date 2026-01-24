<template>
  <div class="performance-tests-view">
    <!-- Performance Metrics Overview -->
    <el-row :gutter="24" class="metrics-overview">
      <el-col :xs="12" :sm="6" v-for="metric in performanceMetrics" :key="metric.name">
        <el-card class="metric-card" shadow="hover">
          <div class="metric-content">
            <el-icon class="metric-icon" :color="metric.color" :size="32">
              <component :is="metric.icon" />
            </el-icon>
            <div class="metric-info">
              <div class="metric-value">{{ metric.value }}</div>
              <div class="metric-label">{{ 
                metric.name === 'avgRenderTime' ? t('performanceTests.avgRenderTime') :
                metric.name === 'avgExpressionTime' ? t('performanceTests.avgExpressionTime') :
                metric.name === 'totalTests' ? t('performanceTests.totalTests') :
                metric.name === 'memoryUsage' ? t('performanceTests.memoryUsage') :
                metric.name
              }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Test Categories -->
    <el-tabs v-model="activeCategory" type="border-card" class="test-categories">
      <!-- Rendering Performance -->
      <el-tab-pane :label="$t('performanceTests.renderingPerformance')" name="rendering">
        <div class="test-section">
          <h3>{{ $t('performanceTests.largeNodeRendering') }}</h3>
          <el-card>
            <div class="test-controls">
              <el-button-group>
                <el-button 
                  type="primary" 
                  @click="runRenderingTest(1000)"
                  :loading="renderingTestRunning"
                >
                  {{ $t('performanceTests.testNodes', [1000]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runRenderingTest(5000)"
                  :loading="renderingTestRunning"
                >
                  {{ $t('performanceTests.testNodes', [5000]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runRenderingTest(10000)"
                  :loading="renderingTestRunning"
                >
                  {{ $t('performanceTests.testNodes', [10000]) }}
                </el-button>
              </el-button-group>
            </div>
            <div v-if="renderingTestResult" class="test-result">
              <el-alert
                :type="renderingTestResult.success ? 'success' : 'error'"
                :title="`${$t('performanceTests.renderingPerformance')} ${$t('performanceTests.testNodes', [renderingTestResult.nodeCount])}${$t('performanceTests.timeSpent')}${renderingTestResult.duration}ms`"
                :description="renderingTestResult.message"
                show-icon
                :closable="false"
              />
            </div>
            <div v-if="renderingTestVnode" class="render-preview" style="margin-top: 24px;">
              <el-card>
                <template #header>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>{{ $t('performanceTests.renderPreview') }}</span>
                    <el-button size="small" @click="renderingTestVnode = null">{{ $t('performanceTests.clearPreview') }}</el-button>
                  </div>
                </template>
                <div class="preview-container" style="max-height: 400px; overflow-y: auto; padding: 16px;">
                  <VNodeRenderer :vnode="renderingTestVnode" />
                </div>
              </el-card>
            </div>
          </el-card>

          <h3 style="margin-top: 24px;">{{ $t('performanceTests.deepNestingStructure') }}</h3>
          <el-card>
            <div class="test-controls">
              <el-button-group>
                <el-button 
                  type="primary" 
                  @click="runNestingTest(20)"
                  :loading="nestingTestRunning"
                >
                  {{ $t('performanceTests.testNesting', [20]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runNestingTest(50)"
                  :loading="nestingTestRunning"
                >
                  {{ $t('performanceTests.testNesting', [50]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runNestingTest(100)"
                  :loading="nestingTestRunning"
                >
                  {{ $t('performanceTests.testNesting', [100]) }}
                </el-button>
              </el-button-group>
            </div>
            <div v-if="nestingTestResult" class="test-result">
              <el-alert
                :type="nestingTestResult.success ? 'success' : 'error'"
                :title="`${$t('performanceTests.testNesting', [nestingTestResult.depth])}${$t('performanceTests.timeSpent')}${nestingTestResult.duration}ms`"
                :description="nestingTestResult.message"
                show-icon
                :closable="false"
              />
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- Loop Performance -->
      <el-tab-pane :label="$t('performanceTests.loopRendering')" name="loop">
        <div class="test-section">
          <h3>{{ $t('performanceTests.largeLoopItemRendering') }}</h3>
          <el-card>
            <div class="test-controls">
              <el-button-group>
                <el-button 
                  type="primary" 
                  @click="runLoopTest(1000)"
                  :loading="loopTestRunning"
                >
                  {{ $t('performanceTests.testItems', [1000]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runLoopTest(5000)"
                  :loading="loopTestRunning"
                >
                  {{ $t('performanceTests.testItems', [5000]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runLoopTest(10000)"
                  :loading="loopTestRunning"
                >
                  {{ $t('performanceTests.testItems', [10000]) }}
                </el-button>
              </el-button-group>
            </div>
            <div v-if="loopTestResult" class="test-result">
              <el-alert
                :type="loopTestResult.success ? 'success' : 'error'"
                :title="`${$t('performanceTests.loopRendering')} ${$t('performanceTests.testItems', [loopTestResult.itemCount])}${$t('performanceTests.timeSpent')}${loopTestResult.duration}ms`"
                :description="loopTestResult.message"
                show-icon
                :closable="false"
              />
            </div>
            <div v-if="loopTestVnode" class="render-preview" style="margin-top: 24px;">
              <el-card>
                <template #header>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>{{ $t('performanceTests.renderPreview') }}</span>
                    <el-button size="small" @click="loopTestVnode = null">{{ $t('performanceTests.clearPreview') }}</el-button>
                  </div>
                </template>
                <div class="preview-container" style="max-height: 400px; overflow-y: auto; padding: 16px;">
                  <VNodeRenderer :vnode="loopTestVnode" />
                </div>
              </el-card>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- Expression Performance -->
      <el-tab-pane :label="$t('performanceTests.expressionCalculation')" name="expression">
        <div class="test-section">
          <h3>{{ $t('performanceTests.expressionEvaluationPerformance') }}</h3>
          <el-card>
            <div class="test-controls">
              <el-button-group>
                <el-button 
                  type="primary" 
                  @click="runExpressionTest(100)"
                  :loading="expressionTestRunning"
                >
                  {{ $t('performanceTests.testExpressions', [100]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runExpressionTest(1000)"
                  :loading="expressionTestRunning"
                >
                  {{ $t('performanceTests.testExpressions', [1000]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runExpressionTest(5000)"
                  :loading="expressionTestRunning"
                >
                  {{ $t('performanceTests.testExpressions', [5000]) }}
                </el-button>
              </el-button-group>
            </div>
            <div v-if="expressionTestResult" class="test-result">
              <el-alert
                :type="expressionTestResult.success ? 'success' : 'error'"
                :title="`${$t('performanceTests.testExpressions', [expressionTestResult.exprCount])}${$t('performanceTests.timeSpent')}${expressionTestResult.duration}ms`"
                :description="expressionTestResult.message"
                show-icon
                :closable="false"
              />
            </div>
          </el-card>

          <h3 style="margin-top: 24px;">{{ $t('performanceTests.cachePerformance') }}</h3>
          <el-card>
            <div class="test-controls">
              <el-button 
                type="primary" 
                @click="runCacheTest"
                :loading="cacheTestRunning"
              >
                {{ $t('performanceTests.testCachePerformance') }}
              </el-button>
            </div>
            <div v-if="cacheTestResult" class="test-result">
              <el-alert
                type="success"
                :title="`缓存提升: ${cacheTestResult.improvement}%`"
                :description="`无缓存: ${cacheTestResult.noCacheTime}ms, 有缓存: ${cacheTestResult.cacheTime}ms`"
                show-icon
                :closable="false"
              />
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- State Update Performance -->
      <el-tab-pane :label="$t('performanceTests.stateUpdate')" name="state">
        <div class="test-section">
          <h3>{{ $t('performanceTests.frequentStateUpdates') }}</h3>
          <el-card>
            <div class="test-controls">
              <el-button-group>
                <el-button 
                  type="primary" 
                  @click="runStateUpdateTest(1000)"
                  :loading="stateUpdateTestRunning"
                >
                  {{ $t('performanceTests.testUpdates', [1000]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runStateUpdateTest(10000)"
                  :loading="stateUpdateTestRunning"
                >
                  {{ $t('performanceTests.testUpdates', [10000]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runStateUpdateTest(100000)"
                  :loading="stateUpdateTestRunning"
                >
                  {{ $t('performanceTests.testUpdates', [100000]) }}
                </el-button>
              </el-button-group>
            </div>
            <div v-if="stateUpdateTestResult" class="test-result">
              <el-alert
                :type="stateUpdateTestResult.success ? 'success' : 'error'"
                :title="`${$t('performanceTests.testUpdates', [stateUpdateTestResult.updateCount])}${$t('performanceTests.timeSpent')}${stateUpdateTestResult.duration}ms`"
                :description="stateUpdateTestResult.message"
                show-icon
                :closable="false"
              />
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- Global Component Rendering -->
      <el-tab-pane :label="$t('performanceTests.globalComponentRendering')" name="components">
        <div class="test-section">
          <h3>{{ $t('performanceTests.largeScaleComponentRendering') }}</h3>
          <el-card>
            <div class="test-controls">
              <el-form :inline="true" label-width="120px">
                <el-form-item :label="$t('performanceTests.componentType')">
                  <el-select v-model="componentTestType" style="width: 200px;">
                    <el-option label="ElButton" value="ElButton" />
                    <el-option label="ElCard" value="ElCard" />
                    <el-option label="ElTag" value="ElTag" />
                    <el-option label="ElInput" value="ElInput" />
                    <el-option label="混合组件" value="mixed" />
                  </el-select>
                </el-form-item>
              </el-form>
              <el-button-group style="margin-top: 12px;">
                <el-button 
                  type="primary" 
                  @click="runComponentTest(500)"
                  :loading="componentTestRunning"
                >
                  {{ $t('performanceTests.testComponents', [500]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runComponentTest(1000)"
                  :loading="componentTestRunning"
                >
                  {{ $t('performanceTests.testComponents', [1000]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runComponentTest(2000)"
                  :loading="componentTestRunning"
                >
                  {{ $t('performanceTests.testComponents', [2000]) }}
                </el-button>
                <el-button 
                  type="primary" 
                  @click="runComponentTest(5000)"
                  :loading="componentTestRunning"
                >
                  {{ $t('performanceTests.testComponents', [5000]) }}
                </el-button>
              </el-button-group>
            </div>
            <div v-if="componentTestResult" class="test-result">
              <el-alert
                :type="componentTestResult.success ? 'success' : 'error'"
                :title="`${$t('performanceTests.globalComponentRendering')} ${componentTestResult.componentType} x${componentTestResult.componentCount}${$t('performanceTests.timeSpent')}${componentTestResult.duration}ms`"
                :description="componentTestResult.message"
                show-icon
                :closable="false"
              />
            </div>
            <div v-if="componentTestVnode" class="render-preview" style="margin-top: 24px;">
              <el-card>
                <template #header>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>{{ $t('performanceTests.renderPreview') }}</span>
                    <el-button size="small" @click="componentTestVnode = null">{{ $t('performanceTests.clearPreview') }}</el-button>
                  </div>
                </template>
                <div class="preview-container" style="max-height: 600px; overflow-y: auto; padding: 16px;">
                  <VNodeRenderer :vnode="componentTestVnode" />
                </div>
              </el-card>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- Custom Configurable Test -->
      <el-tab-pane :label="$t('performanceTests.customConfigurableTest')" name="custom">
        <div class="test-section">
          <h3>{{ $t('performanceTests.configurableRenderingTest') }}</h3>
          <el-card>
            <div class="test-controls">
              <el-form :inline="true" label-width="140px" style="margin-bottom: 16px;">
                <el-form-item :label="$t('performanceTests.testScenario')">
                  <el-select v-model="customTestConfig.scenario" style="width: 300px;">
                    <el-option :label="$t('performanceTests.scenarioSimpleButtons')" value="simpleButtons" />
                    <el-option :label="$t('performanceTests.scenarioNestedCards')" value="nestedCards" />
                    <el-option :label="$t('performanceTests.scenarioFormComponents')" value="formComponents" />
                    <el-option :label="$t('performanceTests.scenarioGridLayout')" value="gridLayout" />
                    <el-option :label="$t('performanceTests.scenarioTreeStructure')" value="treeStructure" />
                    <el-option :label="$t('performanceTests.scenarioMixedComplex')" value="mixedComplex" />
                    <el-option :label="$t('performanceTests.scenarioDeepNesting')" value="deepNesting" />
                    <el-option :label="$t('performanceTests.scenarioTableRows')" value="tableRows" />
                  </el-select>
                </el-form-item>
                <el-form-item :label="$t('performanceTests.componentCount')">
                  <el-input-number 
                    v-model="customTestConfig.componentCount" 
                    :min="1" 
                    :max="10000" 
                    :step="100"
                    style="width: 150px;"
                  />
                </el-form-item>
              </el-form>
              <el-button 
                type="primary" 
                size="large"
                @click="runCustomTest"
                :loading="customTestRunning"
              >
                {{ $t('performanceTests.runCustomTest') }}
              </el-button>
            </div>
            <div v-if="customTestResult" class="test-result">
              <el-alert
                :type="customTestResult.success ? 'success' : 'error'"
                :title="`${$t('performanceTests.customTestResult')}: ${customTestResult.duration}ms`"
                :description="customTestResult.message"
                show-icon
                :closable="false"
              />
            </div>
            <div v-if="customTestVnodeRef" class="render-preview" style="margin-top: 24px;">
              <el-card>
                <template #header>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>{{ $t('performanceTests.renderPreview') }}</span>
                    <el-button size="small" @click="customTestVnodeRef = null">{{ $t('performanceTests.clearPreview') }}</el-button>
                  </div>
                </template>
                <div class="preview-container" style="max-height: 600px; overflow-y: auto; padding: 16px;">
                  <VNodeRenderer :vnodeRef="customTestVnodeRef" />
                </div>
              </el-card>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- Mixed Performance -->
      <el-tab-pane :label="$t('performanceTests.mixedPressure')" name="mixed">
        <div class="test-section">
          <h3>{{ $t('performanceTests.complexMixedScenarios') }}</h3>
          <el-card>
            <div class="test-controls">
              <el-button 
                type="primary" 
                @click="runMixedTest"
                :loading="mixedTestRunning"
              >
                {{ $t('performanceTests.runMixedPressureTest') }}
              </el-button>
            </div>
            <div v-if="mixedTestResult" class="test-result">
              <el-alert
                :type="mixedTestResult.success ? 'success' : 'error'"
                :title="`混合压力测试耗时: ${mixedTestResult.duration}ms`"
                :description="mixedTestResult.message"
                show-icon
                :closable="false"
              />
            </div>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- Performance Chart -->
    <el-card class="performance-chart-card" style="margin-top: 24px;">
      <template #header>
        <div class="chart-header">
          <h3>{{ $t('performanceTests.performanceTrend') }}</h3>
          <el-button size="small" @click="clearHistory">{{ $t('performanceTests.clearHistory') }}</el-button>
        </div>
      </template>
      <div class="chart-container">
        <div v-if="performanceHistory.length === 0" class="chart-placeholder">
          <p>{{ $t('performanceTests.runTestToViewPerformanceTrend') }}</p>
        </div>
        <div v-else ref="chartContainer" class="chart-content" style="width: 100%; height: 400px;"></div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick, defineComponent, h, getCurrentInstance, onMounted, onUnmounted, watch, shallowRef, computed, type VNode, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVario } from '@variojs/vue'
import type { Schema } from '@variojs/schema'
import { Timer, Lightning, DataBoard, Monitor } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { createScenarioSchema, type TestScenario } from '../examples/performance-scenarios'

// 获取当前组件实例的 app，用于传递给 useVario（在非 setup 上下文中调用时）
const instance = getCurrentInstance()
const app = instance?.appContext.app

// VNode 渲染器组件 - 支持响应式 vnode ref
const VNodeRenderer = defineComponent({
  name: 'VNodeRenderer',
  props: {
    vnode: {
      type: Object as () => VNode | null,
      default: null
    },
    vnodeRef: {
      type: Object,
      default: null
    }
  },
  setup(props) {
    // 使用 computed 来追踪嵌套 ref 的变化
    const computedVnode = computed(() => {
      const vnodeRefValue = props.vnodeRef as Ref<VNode | null> | null
      return vnodeRefValue?.value ?? props.vnode
    })
    return { computedVnode }
  },
  render() {
    return this.computedVnode || h('div', 'Loading...')
  }
})

const { t, locale } = useI18n()
const activeCategory = ref('rendering')

// Performance metrics - keep as reactive array for mutability
const performanceMetrics = reactive([
  {
    name: 'avgRenderTime',
    value: '0ms',
    color: '#3B82F6',
    icon: Timer
  },
  {
    name: 'avgExpressionTime',
    value: '0ms',
    color: '#10B981',
    icon: Lightning
  },
  {
    name: 'totalTests',
    value: '0',
    color: '#8B5CF6',
    icon: DataBoard
  },
  {
    name: 'memoryUsage',
    value: '0MB',
    color: '#F59E0B',
    icon: Monitor
  }
])

// Test states
const renderingTestRunning = ref(false)
const renderingTestResult = ref<any>(null)
const renderingTestVnode = ref<VNode | null>(null)

const nestingTestRunning = ref(false)
const nestingTestResult = ref<any>(null)

const loopTestRunning = ref(false)
const loopTestResult = ref<any>(null)
const loopTestVnode = ref<VNode | null>(null)

const expressionTestRunning = ref(false)
const expressionTestResult = ref<any>(null)

const cacheTestRunning = ref(false)
const cacheTestResult = ref<any>(null)

const stateUpdateTestRunning = ref(false)
const stateUpdateTestResult = ref<any>(null)

const mixedTestRunning = ref(false)
const mixedTestResult = ref<any>(null)

const componentTestRunning = ref(false)
const componentTestResult = ref<any>(null)
const componentTestVnode = ref<VNode | null>(null)
const componentTestType = ref('ElButton')

const customTestRunning = ref(false)
const customTestResult = ref<any>(null)
// 使用 shallowRef 存储 vnode ref 本身，保持响应式连接
// 类型注解：存储的是 useVario 返回的 vnode ref
const customTestVnodeRef = shallowRef<any>(null)
const customTestConfig = reactive<{
  scenario: TestScenario
  componentCount: number
}>({
  scenario: 'simpleButtons',
  componentCount: 100
})

// Performance history
const performanceHistory = ref<Array<{ label: string; duration: number; color: string }>>([])
const chartContainer = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

// Rendering test
const runRenderingTest = async (nodeCount: number) => {
  renderingTestRunning.value = true
  renderingTestResult.value = null

  try {
    const startTime = performance.now()
    
    const children: Schema[] = Array.from({ length: nodeCount }, (_, i) => ({
      type: 'div',
      props: { id: `node-${i}` },
      children: `Node ${i}`
    }))

    const schema: Schema = {
      type: 'div',
      children
    }

    const { vnode } = useVario(schema, { app })
    await nextTick()

    const endTime = performance.now()
    const duration = endTime - startTime

    // 保存渲染结果用于展示（限制显示数量，避免页面卡顿）
    if (nodeCount <= 100) {
      renderingTestVnode.value = vnode.value
    } else {
      // 对于大量节点，只渲染前 100 个作为预览
      const previewSchema: Schema = {
        type: 'div',
        children: children.slice(0, 100)
      }
      const { vnode: previewVnode } = useVario(previewSchema, { app })
      await nextTick()
      renderingTestVnode.value = previewVnode.value
    }

    renderingTestResult.value = {
      success: true,
      nodeCount,
      duration: duration.toFixed(2),
      message: `成功渲染 ${nodeCount} 个节点${nodeCount > 100 ? '（预览显示前 100 个）' : ''}`
    }

    updateMetrics('avgRenderTime', `${duration.toFixed(2)}ms`)
    updateMetrics('memoryUsage', getMemoryUsage())
    addToHistory(`渲染 ${nodeCount} 节点`, duration, '#3B82F6')
  } catch (error) {
    renderingTestResult.value = {
      success: false,
      nodeCount,
      duration: '0',
      message: `错误: ${error}`
    }
  } finally {
    renderingTestRunning.value = false
  }
}

// Nesting test
const runNestingTest = async (depth: number) => {
  nestingTestRunning.value = true
  nestingTestResult.value = null

  try {
    const startTime = performance.now()
    
    let schema: Schema = { type: 'div', children: 'Deep' }
    for (let i = 0; i < depth; i++) {
      schema = {
        type: 'div',
        props: { class: `level-${i}` },
        children: [schema]
      }
    }

    const { vnode: _vnode } = useVario(schema, { app })
    await nextTick()

    const endTime = performance.now()
    const duration = endTime - startTime

    nestingTestResult.value = {
      success: true,
      depth,
      duration: duration.toFixed(2),
      message: `成功渲染 ${depth} 层嵌套结构`
    }

    updateMetrics('memoryUsage', getMemoryUsage())
    addToHistory(`${depth} 层嵌套`, duration, '#10B981')
  } catch (error) {
    nestingTestResult.value = {
      success: false,
      depth,
      duration: '0',
      message: `错误: ${error}`
    }
  } finally {
    nestingTestRunning.value = false
  }
}

// Loop test
const runLoopTest = async (itemCount: number) => {
  loopTestRunning.value = true
  loopTestResult.value = null

  try {
    const startTime = performance.now()
    
    const schema: Schema<{ items: Array<{ id: number; name: string }> }> = {
      type: 'div',
      children: [
        {
          type: 'div',
          loop: {
            items: '{{ items }}',
            itemKey: 'id'
          },
          children: '{{ $record.name }}'
        }
      ]
    }

    const { vnode, ctx } = useVario(schema, { app })
    
    const items = Array.from({ length: itemCount }, (_, i) => ({
      id: i,
      name: `Item ${i}`
    }))
    
    ctx.value!._set('items', items)
    await nextTick()

    const endTime = performance.now()
    const duration = endTime - startTime

    // 保存渲染结果用于展示（限制显示数量）
    if (itemCount <= 100) {
      loopTestVnode.value = vnode.value
    } else {
      // 对于大量项，只渲染前 100 个作为预览
      const previewItems = items.slice(0, 100)
      ctx.value!._set('items', previewItems)
      await nextTick()
      loopTestVnode.value = vnode.value
      // 恢复完整数据
      ctx.value!._set('items', items)
    }

    loopTestResult.value = {
      success: true,
      itemCount,
      duration: duration.toFixed(2),
      message: `成功渲染 ${itemCount} 项循环列表${itemCount > 100 ? '（预览显示前 100 项）' : ''}`
    }

    updateMetrics('memoryUsage', getMemoryUsage())
    addToHistory(`循环 ${itemCount} 项`, duration, '#8B5CF6')
  } catch (error) {
    loopTestResult.value = {
      success: false,
      itemCount,
      duration: '0',
      message: `错误: ${error}`
    }
  } finally {
    loopTestRunning.value = false
  }
}

// Expression test
const runExpressionTest = async (exprCount: number) => {
  expressionTestRunning.value = true
  expressionTestResult.value = null

  try {
    const startTime = performance.now()
    
    const children: Schema[] = Array.from({ length: exprCount }, (_, i) => ({
      type: 'div',
      children: `{{ count + ${i} }}`
    }))

    const schema: Schema<{ count: number }> = {
      type: 'div',
      children
    }

    const { vnode: _vnode, ctx } = useVario(schema, { app })
    ctx.value!._set('count', 10)
    await nextTick()

    const endTime = performance.now()
    const duration = endTime - startTime

    expressionTestResult.value = {
      success: true,
      exprCount,
      duration: duration.toFixed(2),
      message: `成功计算 ${exprCount} 个表达式`
    }

    updateMetrics('avgExpressionTime', `${duration.toFixed(2)}ms`)
    updateMetrics('memoryUsage', getMemoryUsage())
    addToHistory(`${exprCount} 个表达式`, duration, '#F59E0B')
  } catch (error) {
    expressionTestResult.value = {
      success: false,
      exprCount,
      duration: '0',
      message: `错误: ${error}`
    }
  } finally {
    expressionTestRunning.value = false
  }
}

// Cache test
const runCacheTest = async () => {
  cacheTestRunning.value = true
  cacheTestResult.value = null

  try {
    const schema: Schema<{ count: number }> = {
      type: 'div',
      children: [
        { type: 'div', children: '{{ count * 2 }}' },
        { type: 'div', children: '{{ count * 2 }}' },
        { type: 'div', children: '{{ count * 2 }}' }
      ]
    }

    const { vnode: _vnode, ctx } = useVario(schema, { app })
    
    // First run (no cache)
    const start1 = performance.now()
    for (let i = 0; i < 100; i++) {
      ctx.value!._set('count', i)
      await nextTick()
    }
    const time1 = performance.now() - start1
    
    // Second run (with cache)
    const start2 = performance.now()
    for (let i = 0; i < 100; i++) {
      ctx.value!._set('count', i)
      await nextTick()
    }
    const time2 = performance.now() - start2
    
    const improvement = ((time1 - time2) / time1 * 100).toFixed(1)

    cacheTestResult.value = {
      success: true,
      noCacheTime: time1.toFixed(2),
      cacheTime: time2.toFixed(2),
      improvement
    }

    updateMetrics('memoryUsage', getMemoryUsage())
    addToHistory('缓存性能', time2, '#EC4899')
  } catch (error) {
    cacheTestResult.value = {
      success: false,
      noCacheTime: '0',
      cacheTime: '0',
      improvement: '0'
    }
  } finally {
    cacheTestRunning.value = false
  }
}

// State update test
const runStateUpdateTest = async (updateCount: number) => {
  stateUpdateTestRunning.value = true
  stateUpdateTestResult.value = null

  try {
    const schema: Schema<{ count: number }> = {
      type: 'div',
      children: '{{ count }}'
    }

    const { vnode: _vnode, ctx } = useVario(schema, { app })
    
    const startTime = performance.now()
    
    for (let i = 0; i < updateCount; i++) {
      ctx.value!._set('count', i)
    }
    
    await nextTick()
    
    const endTime = performance.now()
    const duration = endTime - startTime

    stateUpdateTestResult.value = {
      success: true,
      updateCount,
      duration: duration.toFixed(2),
      message: `成功执行 ${updateCount} 次状态更新`
    }

    updateMetrics('memoryUsage', getMemoryUsage())
    addToHistory(`${updateCount} 次更新`, duration, '#6366F1')
  } catch (error) {
    stateUpdateTestResult.value = {
      success: false,
      updateCount,
      duration: '0',
      message: `错误: ${error}`
    }
  } finally {
    stateUpdateTestRunning.value = false
  }
}

// Global component rendering test
const runComponentTest = async (componentCount: number) => {
  componentTestRunning.value = true
  componentTestResult.value = null

  try {
    const startTime = performance.now()
    const componentType = componentTestType.value
    
    let children: Schema[]
    
    if (componentType === 'mixed') {
      // 混合组件测试
      const componentTypes = ['ElButton', 'ElCard', 'ElTag', 'ElInput']
      children = Array.from({ length: componentCount }, (_, i) => {
        const type = componentTypes[i % componentTypes.length]
        if (type === 'ElButton') {
          return {
            type: 'ElButton',
            props: { type: i % 3 === 0 ? 'primary' : i % 3 === 1 ? 'success' : 'info', size: 'default' },
            children: `Button ${i}`
          } as Schema
        } else if (type === 'ElCard') {
          return {
            type: 'ElCard',
            props: { shadow: 'hover', style: 'margin-bottom: 8px;' },
            children: [
              { type: 'div', props: { style: 'font-weight: bold;' }, children: `Card ${i}` },
              { type: 'div', children: `Content for card ${i}` }
            ]
          } as Schema
        } else if (type === 'ElTag') {
          return {
            type: 'ElTag',
            props: { type: i % 4 === 0 ? 'success' : i % 4 === 1 ? 'warning' : i % 4 === 2 ? 'danger' : 'info' },
            children: `Tag ${i}`
          } as Schema
        } else {
          return {
            type: 'ElInput',
            props: { placeholder: `Input ${i}` },
            model: `input${i}`
          } as Schema
        }
      })
    } else {
      // 单一组件类型测试
      if (componentType === 'ElButton') {
        children = Array.from({ length: componentCount }, (_, i) => ({
          type: 'ElButton',
          props: { 
            type: i % 3 === 0 ? 'primary' : i % 3 === 1 ? 'success' : 'info',
            size: i % 2 === 0 ? 'default' : 'small'
          },
          children: `Button ${i}`,
          events: {
            click: [{ type: 'call', method: 'handleClick', params: { index: i } }]
          }
        })) as Schema[]
      } else if (componentType === 'ElCard') {
        children = Array.from({ length: componentCount }, (_, i) => ({
          type: 'ElCard',
          props: { 
            shadow: 'hover',
            header: `Card ${i}`,
            style: 'margin-bottom: 8px;'
          },
          children: `Content for card ${i}`
        })) as Schema[]
      } else if (componentType === 'ElTag') {
        children = Array.from({ length: componentCount }, (_, i) => ({
          type: 'ElTag',
          props: { 
            type: i % 4 === 0 ? 'success' : i % 4 === 1 ? 'warning' : i % 4 === 2 ? 'danger' : 'info',
            size: i % 2 === 0 ? 'default' : 'small'
          },
          children: `Tag ${i}`
        })) as Schema[]
      } else if (componentType === 'ElInput') {
        children = Array.from({ length: componentCount }, (_, i) => ({
          type: 'ElInput',
          props: { 
            placeholder: `Input ${i}`,
            clearable: true,
            style: 'margin-bottom: 8px;'
          },
          model: `input${i}`
        })) as Schema[]
      } else {
        children = []
      }
    }

    const schema: Schema = {
      type: 'div',
      props: { style: 'display: flex; flex-wrap: wrap; gap: 8px; padding: 16px;' },
      children
    }

    const { vnode } = useVario(schema, {
      app,
      state: {},
      methods: {
        handleClick: () => {
          // 空方法，仅用于测试事件绑定性能
        }
      }
    })
    
    await nextTick()

    const endTime = performance.now()
    const duration = endTime - startTime

    // 保存渲染结果用于展示（限制显示数量，避免页面卡顿）
    if (componentCount <= 200) {
      componentTestVnode.value = vnode.value
    } else {
      // 对于大量组件，只渲染前 200 个作为预览
      const previewChildren = children.slice(0, 200)
      const previewSchema: Schema = {
        type: 'div',
        props: { style: 'display: flex; flex-wrap: wrap; gap: 8px; padding: 16px;' },
        children: previewChildren
      }
      const { vnode: previewVnode } = useVario(previewSchema, {
        app,
        state: {},
        methods: {
          handleClick: () => {}
        }
      })
      await nextTick()
      componentTestVnode.value = previewVnode.value
    }

    componentTestResult.value = {
      success: true,
      componentType,
      componentCount,
      duration: duration.toFixed(2),
      message: `成功渲染 ${componentCount} 个 ${componentType} 组件${componentCount > 200 ? '（预览显示前 200 个）' : ''}`
    }

    updateMetrics('avgRenderTime', `${duration.toFixed(2)}ms`)
    updateMetrics('memoryUsage', getMemoryUsage())
    addToHistory(`${componentType} x${componentCount}`, duration, '#EF4444')
  } catch (error) {
    componentTestResult.value = {
      success: false,
      componentType: componentTestType.value,
      componentCount,
      duration: '0',
      message: `错误: ${error}`
    }
  } finally {
    componentTestRunning.value = false
  }
}

// Mixed test
const runMixedTest = async () => {
  mixedTestRunning.value = true
  mixedTestResult.value = null

  try {
    const startTime = performance.now()
    
    const schema: Schema<{
      items: Array<{ name: string; value: number }>
      multiplier: number
      count: number
    }> = {
      type: 'div',
      children: [
        {
          type: 'div',
          children: '{{ count }}'
        },
        {
          type: 'div',
          loop: {
            items: '{{ items }}',
            itemKey: 'index'
          },
          children: [
            {
              type: 'div',
              children: '{{ $record.name }}'
            },
            {
              type: 'div',
              children: '{{ $record.value * multiplier }}'
            }
          ]
        }
      ]
    }

    const { vnode: _vnode, ctx } = useVario(schema, { app })
    
    const items = Array.from({ length: 100 }, (_, i) => ({
      name: `Item ${i}`,
      value: i
    }))
    
    ctx.value!._set('items', items)
    ctx.value!._set('multiplier', 2)
    ctx.value!._set('count', 0)
    await nextTick()
    
    for (let i = 0; i < 50; i++) {
      ctx.value!._set('count', i)
      ctx.value!._set('multiplier', i % 10)
      await nextTick()
    }
    
    const endTime = performance.now()
    const duration = endTime - startTime

    mixedTestResult.value = {
      success: true,
      duration: duration.toFixed(2),
      message: '混合压力测试完成'
    }

    updateMetrics('memoryUsage', getMemoryUsage())
    addToHistory('混合压力测试', duration, '#14B8A6')
  } catch (error) {
    mixedTestResult.value = {
      success: false,
      duration: '0',
      message: `错误: ${error}`
    }
  } finally {
    mixedTestRunning.value = false
  }
}

// Helper functions
const updateMetrics = (key: string, value: string) => {
  const metric = performanceMetrics.find(m => m.name === key)
  if (metric) {
    if (key === 'totalTests') {
      // For totalTests, increment the count
      const current = parseInt(metric.value || '0')
      metric.value = String(current + 1)
    } else {
      // For other metrics, set the value directly
      metric.value = value
    }
  }
}

// Get memory usage (if available)
const getMemoryUsage = (): string => {
  if ('memory' in performance && (performance as any).memory) {
    const memory = (performance as any).memory
    const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100
    return `${usedMB}MB`
  }
  return 'N/A'
}

const addToHistory = (label: string, duration: number, color: string) => {
  performanceHistory.value.unshift({ label, duration, color })
  if (performanceHistory.value.length > 20) {
    performanceHistory.value = performanceHistory.value.slice(0, 20)
  }
  
  updateMetrics('totalTests', '')
}

const clearHistory = () => {
  performanceHistory.value = []
  updateMetrics('totalTests', '0')
  updateChart()
}

// Custom configurable test
const runCustomTest = async () => {
  customTestRunning.value = true
  customTestResult.value = null

  try {
    const startTime = performance.now()
    const { scenario, componentCount } = customTestConfig
    
    // 使用场景工厂函数创建 schema
    const schema = createScenarioSchema(scenario as TestScenario, componentCount)

    const { vnode } = useVario(schema, { app })
    await nextTick()

    const endTime = performance.now()
    const duration = endTime - startTime

    // 保存 vnode ref 本身（而非 .value），保持响应式连接
    customTestVnodeRef.value = vnode

    const scenarioNames: Record<string, string> = {
      simpleButtons: t('performanceTests.scenarioSimpleButtons'),
      nestedCards: t('performanceTests.scenarioNestedCards'),
      formComponents: t('performanceTests.scenarioFormComponents'),
      gridLayout: t('performanceTests.scenarioGridLayout'),
      treeStructure: t('performanceTests.scenarioTreeStructure'),
      mixedComplex: t('performanceTests.scenarioMixedComplex'),
      deepNesting: t('performanceTests.scenarioDeepNesting'),
      tableRows: t('performanceTests.scenarioTableRows')
    }

    customTestResult.value = {
      success: true,
      scenario,
      componentCount,
      duration: duration.toFixed(2),
      message: `${scenarioNames[scenario]} - 成功渲染 ${componentCount} 个组件`
    }

    updateMetrics('avgRenderTime', `${duration.toFixed(2)}ms`)
    updateMetrics('memoryUsage', getMemoryUsage())
    addToHistory(`${scenarioNames[scenario]} (${componentCount})`, duration, '#8B5CF6')
  } catch (error) {
    customTestResult.value = {
      success: false,
      scenario: customTestConfig.scenario,
      componentCount: customTestConfig.componentCount,
      duration: '0',
      message: `错误: ${error}`
    }
  } finally {
    customTestRunning.value = false
  }
}

// ECharts 图表更新
const updateChart = () => {
  if (!chartContainer.value || performanceHistory.value.length === 0) {
    if (chartInstance) {
      chartInstance.dispose()
      chartInstance = null
    }
    return
  }

  if (!chartInstance) {
    chartInstance = echarts.init(chartContainer.value)
  }

  const labels = performanceHistory.value.map(item => item.label)
  const durations = performanceHistory.value.map(item => item.duration)
  const colors = performanceHistory.value.map(item => item.color)

  const option = {
    title: {
      text: t('performanceTests.performanceTrend'),
      left: 'center',
      textStyle: {
        fontSize: 16
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        const param = params[0]
        const value = typeof param.value === 'number' ? param.value.toFixed(2) : param.value
        return `${param.name}<br/>${param.seriesName}: ${value}ms`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        rotate: 45,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      name: t('performanceTests.durationMs'),
      axisLabel: {
        formatter: (value: number) => value.toFixed(2)
      }
    },
    series: [
      {
        name: t('performanceTests.renderDuration'),
        type: 'bar',
        data: durations.map((d, i) => ({
          value: d,
          itemStyle: {
            color: colors[i]
          }
        })),
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => `${params.value.toFixed(2)}ms`
        }
      }
    ]
  }

  chartInstance.setOption(option)
}

// 监听性能历史变化，更新图表
watch(performanceHistory, () => {
  nextTick(() => {
    updateChart()
  })
}, { deep: true })

// 监听语言变化，更新图表配置
watch(locale, () => {
  if (chartInstance && performanceHistory.value.length > 0) {
    nextTick(() => {
      updateChart()
    })
  }
})

// 组件挂载和卸载时处理图表
onMounted(() => {
  nextTick(() => {
    updateChart()
  })
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style scoped lang="scss">
@use '@src/styles/abstracts/variables' as *;
@use '@src/styles/abstracts/mixins' as *;

.performance-tests-view {
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
    
    @include respond-below(xs) {
      font-size: $font-size-body-mobile;
    }
  }
}

.metrics-overview {
  margin-bottom: $spacing-xl;

  .metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border-default);
    @include transition-transform($transition-base);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    
    .metric-content {
      display: flex;
      align-items: center;
      gap: $spacing-md;

      .metric-icon {
        flex-shrink: 0;
      }

      .metric-info {
        flex: 1;

        .metric-value {
          @include typography-h3;
          color: var(--primary-base);
          margin-bottom: $spacing-xs;
        }

        .metric-label {
          @include typography-body;
          font-size: $font-size-small-desktop;
          color: var(--text-secondary);
        }
      }
    }
  }
}

.test-categories {
  min-height: 500px;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: $radius-lg;

  :deep(.el-tabs__content) {
    padding: $spacing-lg;
    background: var(--bg-base);
  }
  
  :deep(.el-tabs__header) {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-default);
  }
}

.test-section {
  h3 {
    @include typography-h3;
    margin-bottom: $spacing-md;
    color: var(--text-primary);
  }

  .test-controls {
    margin-bottom: $spacing-md;
  }

  .test-result {
    margin-top: $spacing-md;
  }
}

.performance-chart-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: $radius-lg;
  
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      @include typography-h4;
      margin: 0;
      color: var(--text-primary);
    }
  }

  .chart-container {
    min-height: 400px;

    .chart-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 400px;
      color: var(--text-secondary);
    }

    .chart-content {
      width: 100%;
      height: 400px;
    }
  }
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
