<template>
  <div class="test-dashboard-view">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <h1>{{ $t('testDashboard.title') }}</h1>
      <p class="dashboard-subtitle">{{ $t('testDashboard.subtitle') }}</p>
      
      <div class="dashboard-status">
        <el-row :gutter="16">
          <el-col :xs="12" :sm="6">
            <el-statistic 
              :title="$t('testDashboard.totalTests')" 
              :value="testStats.total" 
              :precision="0"
              value-style="color: var(--color-primary)"
            />
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-statistic 
              :title="$t('testDashboard.passing')" 
              :value="testStats.passing" 
              :precision="0"
              value-style="color: var(--color-success)"
            />
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-statistic 
              :title="$t('testDashboard.failing')" 
              :value="testStats.failing" 
              :precision="0"
              value-style="color: var(--color-error)"
            />
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-statistic 
              :title="$t('testDashboard.coverage')" 
              :value="testStats.coverage" 
              suffix="%"
              :precision="1"
              value-style="color: var(--color-warning)"
            />
          </el-col>
        </el-row>
      </div>
    </div>

    <!-- Quick Navigation -->
    <div class="quick-navigation">
      <h2 class="section-title">{{ $t('testDashboard.quickNavigation') }}</h2>
      <el-row :gutter="16">
        <el-col :xs="12" :md="6" v-for="nav in quickNavs" :key="nav.name">
          <el-card 
            class="nav-card" 
            shadow="hover"
            :body-style="{ padding: '0' }"
            @click="navigateTo(nav.route)"
          >
            <div class="nav-icon">
              <component :is="nav.icon" />
            </div>
            <div class="nav-content">
              <h3>{{ nav.title }}</h3>
              <p>{{ nav.description }}</p>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- Test Suite Overview -->
    <div class="test-suite-overview">
      <h2 class="section-title">{{ $t('testDashboard.testSuiteOverview') }}</h2>
      <el-row :gutter="24">
        <el-col :xs="24" :lg="8" v-for="suite in testSuites" :key="suite.name">
          <el-card class="suite-card" shadow="never">
            <template #header>
              <div class="suite-header">
                <el-icon class="suite-icon" :color="suite.color">
                  <component :is="suite.icon" />
                </el-icon>
                <div class="suite-info">
                  <h3>{{ suite.name }}</h3>
                  <el-tag :type="suite.status" size="small">{{ suite.statusText }}</el-tag>
                </div>
                <el-progress 
                  v-if="suite.progress !== undefined"
                  type="circle" 
                  :percentage="suite.progress" 
                  :width="60"
                  :stroke-width="8"
                  :color="suite.color"
                />
              </div>
            </template>

            <div class="suite-metrics">
              <div class="metric-item">
                <span class="metric-label">{{ $t('testDashboard.tests') }}</span>
                <span class="metric-value">{{ suite.tests }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">{{ $t('testDashboard.duration') }}</span>
                <span class="metric-value">{{ suite.duration }}ms</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">{{ $t('testDashboard.passRate') }}</span>
                <span class="metric-value">{{ suite.passRate }}%</span>
              </div>
            </div>

            <template #footer>
              <el-button 
                type="primary" 
                plain 
                @click="runTestSuite(suite)"
                :loading="suite.running"
              >
                {{ suite.running ? $t('testDashboard.running') : $t('testDashboard.runTests') }}
              </el-button>
              <el-button @click="viewTestDetails(suite)">{{ $t('testDashboard.details') }}</el-button>
            </template>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- Real-time Test Runner -->
    <div class="realtime-test-runner">
      <h2 class="section-title">{{ $t('testDashboard.realtimeTestRunner') }}</h2>
      <el-card>
        <div class="runner-container">
          <div class="runner-controls">
            <el-button-group>
              <el-button 
                type="primary" 
                @click="startTestRun"
                :disabled="testRunActive"
              >
                <el-icon><VideoPlay /></el-icon>
                {{ $t('testDashboard.startTestRun') }}
              </el-button>
              <el-button 
                @click="stopTestRun"
                :disabled="!testRunActive"
              >
                <el-icon><VideoPause /></el-icon>
                {{ $t('testDashboard.stop') }}
              </el-button>
              <el-button @click="runAllTests">
                <el-icon><Cpu /></el-icon>
                {{ $t('testDashboard.runAll') }}
              </el-button>
            </el-button-group>

            <el-select 
              v-model="selectedTestSuite" 
              :placeholder="$t('testDashboard.selectTestSuite')"
              class="suite-select"
            >
              <el-option
                v-for="suite in testSuites"
                :key="suite.name"
                :label="suite.name"
                :value="suite.name"
              />
            </el-select>
          </div>

          <div class="test-results">
            <el-table 
              :data="testResults" 
              class="results-table"
              :row-class-name="tableRowClassName"
            >
              <el-table-column prop="name" :label="$t('testDashboard.testName')" width="250" />
              <el-table-column prop="suite" :label="$t('testDashboard.suite')" width="120" />
              <el-table-column prop="status" :label="$t('testDashboard.status')" width="100">
                <template #default="scope">
                  <el-tag :type="scope.row.status === 'pass' ? 'success' : 'error'">
                    {{ scope.row.status === 'pass' ? $t('testDashboard.passed') : $t('testDashboard.failed') }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="duration" :label="$t('testDashboard.duration')" width="120">
                <template #default="scope">{{ scope.row.duration }}ms</template>
              </el-table-column>
              <el-table-column prop="message" :label="$t('testDashboard.message')" />
            </el-table>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Performance Metrics -->
    <div class="performance-metrics">
      <h2 class="section-title">{{ $t('testDashboard.performanceMetrics') }}</h2>
      <el-row :gutter="24">
        <el-col :xs="12" :lg="6" v-for="metric in performanceMetrics" :key="metric.name">
          <el-card class="metric-card" shadow="never">
            <template #header>
              <div class="metric-header">
                <el-icon class="metric-icon" :color="metric.color">
                  <component :is="metric.icon" />
                </el-icon>
                <span class="metric-name">{{ metric.name }}</span>
              </div>
            </template>

            <div class="metric-value-large">
              {{ metric.value }}
            </div>

            <div class="metric-trend" :class="metric.trendClass">
              <el-icon :size="16">
                <component :is="metric.trendIcon" />
              </el-icon>
              <span class="trend-value">{{ metric.trendValue }}</span>
            </div>

            <template #footer>
              <div class="metric-description">
                {{ metric.description }}
              </div>
            </template>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- Test Coverage Visualization -->
    <div class="coverage-visualization">
      <h2 class="section-title">{{ $t('testDashboard.testCoverageVisualization') }}</h2>
      <el-card>
        <div class="coverage-container">
          <div class="coverage-chart">
            <div class="chart-placeholder">
              <p>{{ $t('testDashboard.testCoverageChartHint') }}</p>
              <p class="chart-hint">{{ $t('testDashboard.coverageDataCollected') }}</p>
            </div>
          </div>
          
          <div class="coverage-details">
            <h3>{{ $t('testDashboard.coverageDetails') }}</h3>
            <el-progress 
              :percentage="coverageDetails.total" 
              :show-text="false"
              status="success"
              class="mb-2"
            />
            <div class="coverage-stats">
              <div class="stat-item">
                <span class="stat-label">{{ $t('testDashboard.coreRuntime') }}</span>
                <span class="stat-value">{{ coverageDetails.core }}%</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ $t('testDashboard.expressionSystem') }}</span>
                <span class="stat-value">{{ coverageDetails.expression }}%</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ $t('testDashboard.vm') }}</span>
                <span class="stat-value">{{ coverageDetails.vm }}%</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ $t('testDashboard.schema') }}</span>
                <span class="stat-value">{{ coverageDetails.schema }}%</span>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  VideoPlay,
  VideoPause,
  Cpu,
  DocumentChecked,
  Lightning,
  Operation,
  DataBoard,
  PieChart,
  Timer,
  Monitor,
  Connection
} from '@element-plus/icons-vue'

const { t } = useI18n()
const router = useRouter()

const testStats = reactive({
  total: 109,
  passing: 105,
  failing: 4,
  coverage: 89.3
})

const quickNavs = ref([
  {
    name: 'unit',
    title: t('testDashboard.unitTests'),
    description: t('testDashboard.testIndividualComponents'),
    icon: DocumentChecked,
    route: '/unit-tests'
  },
  {
    name: 'integration',
    title: t('testDashboard.integration'),
    description: t('testDashboard.testCompleteWorkflows'),
    icon: Connection,
    route: '/integration-tests'
  },
  {
    name: 'performance',
    title: t('testDashboard.performance'),
    description: t('testDashboard.testPerformanceCharacteristics'),
    icon: Timer,
    route: '/performance-tests'
  },
  {
    name: 'examples',
    title: t('testDashboard.examplesNav'),
    description: t('testDashboard.browsePracticalExamples'),
    icon: Lightning,
    route: '/examples'
  }
])

const testSuites = ref([
  {
    name: 'Runtime Context',
    icon: DataBoard,
    color: '#3B82F6',
    status: 'success',
    statusText: t('testDashboard.passed'),
    progress: 92,
    tests: 6,
    duration: 3,
    passRate: 100,
    running: false
  },
  {
    name: 'Expression System',
    icon: Lightning,
    color: '#10B981',
    status: 'success',
    statusText: t('testDashboard.passed'),
    progress: 87,
    tests: 28,
    duration: 24,
    passRate: 100,
    running: false
  },
  {
    name: 'Instruction VM',
    icon: Operation,
    color: '#F59E0B',
    status: 'warning',
    statusText: t('testDashboard.partial'),
    progress: 76,
    tests: 16,
    duration: 11,
    passRate: 93.8,
    running: false
  },
  {
    name: 'Schema',
    icon: DocumentChecked,
    color: '#8B5CF6',
    status: 'success',
    statusText: t('testDashboard.passed'),
    progress: 85,
    tests: 20,
    duration: 12,
    passRate: 100,
    running: false
  },
  {
    name: 'Performance',
    icon: Timer,
    color: '#EC4899',
    status: 'info',
    statusText: t('testDashboard.ready'),
    progress: 65,
    tests: 15,
    duration: 45,
    passRate: 86.7,
    running: false
  },
  {
    name: 'Integration',
    icon: Connection,
    color: '#6366F1',
    status: 'success',
    statusText: t('testDashboard.passed'),
    progress: 78,
    tests: 24,
    duration: 28,
    passRate: 95.8,
    running: false
  }
])

const testResults = ref<any[]>([
  { name: 'createRuntimeContext', suite: 'Runtime', status: 'pass', duration: 1.2, message: 'Context created successfully' },
  { name: 'state management', suite: 'Runtime', status: 'pass', duration: 0.8, message: 'State properties accessible' },
  { name: 'proxy protection', suite: 'Runtime', status: 'pass', duration: 1.5, message: 'Protected properties cannot be overwritten' },
  { name: 'expression evaluation', suite: 'Expression', status: 'pass', duration: 2.1, message: 'Basic expressions evaluate correctly' },
  { name: 'member access', suite: 'Expression', status: 'pass', duration: 1.8, message: 'Object property access works' },
  { name: 'whitelist validation', suite: 'Expression', status: 'pass', duration: 3.2, message: 'Unsafe syntax rejected' }
])

const selectedTestSuite = ref('')
const testRunActive = ref(false)

const performanceMetrics = ref([
  {
    name: 'Expressions/sec',
    icon: Lightning,
    color: '#10B981',
    value: '2,430',
    trendValue: '+12.5%',
    trendIcon: 'Top',
    trendClass: 'positive',
    description: 'Expression evaluation throughput'
  },
  {
    name: 'Avg Eval Time',
    icon: Timer,
    color: '#F59E0B',
    value: '0.23ms',
    trendValue: '-8.7%',
    trendIcon: 'Bottom',
    trendClass: 'positive',
    description: 'Average expression evaluation time'
  },
  {
    name: 'Cache Hit Rate',
    icon: PieChart,
    color: '#8B5CF6',
    value: '87.4%',
    trendValue: '+3.2%',
    trendIcon: 'Top',
    trendClass: 'positive',
    description: 'Expression cache efficiency'
  },
  {
    name: 'Memory Usage',
    icon: Monitor,
    color: '#3B82F6',
    value: '24.8MB',
    trendValue: '+0.5%',
    trendIcon: 'Top',
    trendClass: 'neutral',
    description: 'Heap memory usage'
  }
])

const coverageDetails = reactive({
  total: 89.3,
  core: 92.1,
  expression: 87.4,
  vm: 76.8,
  schema: 85.2
})

const navigateTo = (route: string) => {
  router.push(route)
}

const runTestSuite = (suite: any) => {
  suite.running = true
  
  // Simulate test execution
  setTimeout(() => {
    suite.running = false
    suite.status = 'success'
    suite.statusText = t('testDashboard.passed')
    suite.progress = Math.min(suite.progress + 5, 100)
    
    // Add test result
    testResults.value.unshift({
      name: `${suite.name} suite`,
      suite: suite.name,
      status: 'pass',
      duration: Math.random() * 100 + 50,
      message: `${suite.tests} tests executed successfully`
    })
  }, 1000)
}

const viewTestDetails = (suite: any) => {
  router.push(`/unit-tests#${suite.name.toLowerCase().replace(' ', '-')}`)
}

const startTestRun = () => {
  testRunActive.value = true
  
  // Simulate test execution
  const interval = setInterval(() => {
    const suites = ['Runtime', 'Expression', 'VM', 'Schema']
    const suite = suites[Math.floor(Math.random() * suites.length)]
    
    testResults.value.unshift({
      name: `test_${Date.now()}`,
      suite,
      status: Math.random() > 0.1 ? 'pass' : 'fail',
      duration: Math.random() * 5 + 1,
      message: Math.random() > 0.1 ? 'Test completed' : 'Assertion failed'
    })
    
    // Keep only recent results
    if (testResults.value.length > 20) {
      testResults.value = testResults.value.slice(0, 20)
    }
  }, 500)
  
  // Stop after 5 seconds
  setTimeout(() => {
    clearInterval(interval)
    testRunActive.value = false
  }, 5000)
}

const stopTestRun = () => {
  testRunActive.value = false
}

const runAllTests = () => {
  testResults.value = []
  testSuites.value.forEach(suite => {
    suite.running = true
    suite.status = 'info'
    suite.statusText = t('testDashboard.running')
  })
  
  // Simulate running all tests
  setTimeout(() => {
    testSuites.value.forEach(suite => {
      suite.running = false
      suite.status = 'success'
      suite.statusText = t('testDashboard.passed')
      suite.progress = Math.min(suite.progress + 8, 100)
    })
    
    testResults.value.push(
      { name: 'All tests completed', suite: 'System', status: 'pass', duration: 1250, message: '109 tests executed with 4 failures' }
    )
  }, 2000)
}

const tableRowClassName = ({ row }: { row: any }) => {
  return row.status === 'pass' ? 'success-row' : 'error-row'
}
</script>

<style scoped lang="scss">
.test-dashboard-view {
  animation: fadeIn 0.5s ease;
}

.dashboard-header {
  margin-bottom: var(--space-12);
  text-align: center;

  h1 {
    font-size: var(--font-size-5xl);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--space-4);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .dashboard-subtitle {
    font-size: var(--font-size-lg);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-8);
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }
}

.section-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-6);
  border-bottom: 2px solid var(--color-border);
  padding-bottom: var(--space-3);
}

.quick-navigation {
  margin-bottom: var(--space-12);

  .nav-card {
    cursor: pointer;
    transition: all var(--transition-base);
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }

    .nav-icon {
      background: var(--color-bg-secondary);
      padding: var(--space-6);
      text-align: center;
      
      svg {
        width: 40px;
        height: 40px;
        color: var(--color-primary);
      }
    }

    .nav-content {
      padding: var(--space-6);

      h3 {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        margin-bottom: var(--space-2);
      }

      p {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-snug);
      }
    }
  }
}

.test-suite-overview {
  margin-bottom: var(--space-12);

  .suite-card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    margin-bottom: var(--space-6);
    
    &:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-md);
    }

    .suite-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      
      .suite-icon {
        width: 48px;
        height: 48px;
        margin-right: var(--space-4);
      }

      .suite-info {
        flex: 1;
        
        h3 {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          margin-bottom: var(--space-2);
        }
      }
    }

    .suite-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-4);
      margin: var(--space-6) 0;

      .metric-item {
        text-align: center;
        
        .metric-label {
          display: block;
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
          margin-bottom: var(--space-1);
        }

        .metric-value {
          display: block;
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary);
        }
      }
    }
  }
}

.realtime-test-runner {
  margin-bottom: var(--space-12);

  .runner-container {
    .runner-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-6);
      flex-wrap: wrap;
      gap: var(--space-4);

      .suite-select {
        width: 200px;
      }
    }

    .results-table {
      :deep(.success-row) {
        --el-table-tr-bg-color: var(--color-success-light);
      }

      :deep(.error-row) {
        --el-table-tr-bg-color: var(--color-error-light);
      }
    }
  }
}

.performance-metrics {
  margin-bottom: var(--space-12);

  .metric-card {
    border: none;
    box-shadow: var(--shadow-sm);
    
    &:hover {
      box-shadow: var(--shadow-md);
    }

    .metric-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      
      .metric-icon {
        width: 24px;
        height: 24px;
      }

      .metric-name {
        font-weight: var(--font-weight-medium);
      }
    }

    .metric-value-large {
      font-size: var(--font-size-3xl);
      font-weight: var(--font-weight-bold);
      text-align: center;
      margin: var(--space-6) 0;
    }

    .metric-trend {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      
      &.positive {
        color: var(--color-success);
      }
      
      &.neutral {
        color: var(--color-warning);
      }
      
      &.negative {
        color: var(--color-error);
      }
    }

    .metric-description {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      text-align: center;
    }
  }
}

.coverage-visualization {
  margin-bottom: var(--space-12);

  .coverage-container {
    display: flex;
    gap: var(--space-8);
    align-items: flex-start;
    
    @media (max-width: 768px) {
      flex-direction: column;
    }

    .coverage-chart {
      flex: 1;
      
      .chart-placeholder {
        height: 300px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--color-bg-tertiary);
        border-radius: var(--radius-lg);
        
        p {
          margin-bottom: var(--space-2);
        }
        
        .chart-hint {
          font-size: var(--font-size-sm);
          color: var(--color-text-tertiary);
        }
      }
    }

    .coverage-details {
      width: 300px;
      
      @media (max-width: 768px) {
        width: 100%;
      }

      h3 {
        font-size: var(--font-size-lg);
        margin-bottom: var(--space-4);
      }

      .coverage-stats {
        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-3) 0;
          border-bottom: 1px solid var(--color-border);

          &:last-child {
            border-bottom: none;
          }

          .stat-label {
            font-size: var(--font-size-sm);
          }

          .stat-value {
            font-weight: var(--font-weight-medium);
            color: var(--color-primary);
          }
        }
      }
    }
  }
}

.mb-2 {
  margin-bottom: var(--space-2);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>