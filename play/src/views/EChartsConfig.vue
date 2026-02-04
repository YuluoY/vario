<template>
  <div class="echarts-config-view">
    <h2>{{ $t('examples.echartsConfig.title') }}</h2>
    <p class="demo-description">{{ $t('examples.echartsConfig.description') }}</p>

    <!-- 配置区域 -->
    <el-card shadow="hover" class="config-card">
      <template #header>
        <div class="card-header">
          <span>{{ $t('examples.echartsConfig.configuration') }}</span>
          <div class="header-actions">
            <el-button-group>
              <el-button
                size="small"
                :type="viewMode === 'table' ? 'primary' : ''"
                @click="viewMode = 'table'"
              >
                {{ $t('examples.echartsConfig.tableView') }}
              </el-button>
              <el-button
                size="small"
                :type="viewMode === 'json' ? 'primary' : ''"
                @click="viewMode = 'json'"
              >
                {{ $t('examples.echartsConfig.jsonView') }}
              </el-button>
            </el-button-group>
          </div>
        </div>
      </template>

      <!-- Series 数量控制 -->
      <div class="config-row">
        <label class="config-label">{{ $t('examples.echartsConfig.seriesCount') }}</label>
        <el-input-number
          v-model="seriesCount"
          :min="1"
          :max="5"
          size="small"
          class="config-control"
        />
      </div>

      <!-- 表格视图 -->
      <div v-if="viewMode === 'table'" class="table-view">
        <h4>{{ $t('examples.echartsConfig.seriesConfiguration') }}</h4>
        <el-card
          v-for="(series, index) in chartOption.series"
          :key="index"
          class="series-card"
          shadow="never"
        >
          <template #header>
            <div class="series-header">
              <strong>Series {{ index + 1 }}</strong>
            </div>
          </template>

          <div class="config-row">
            <label class="config-label">{{ $t('examples.echartsConfig.name') }}</label>
            <el-input
              v-model="series.name"
              size="small"
              class="config-control"
              @input="updateLegend"
            />
          </div>

          <div class="config-row">
            <label class="config-label">{{ $t('examples.echartsConfig.type') }}</label>
            <el-select
              v-model="series.type"
              size="small"
              class="config-control"
            >
              <el-option :label="$t('examples.echartsConfig.typeBar')" value="bar" />
              <el-option :label="$t('examples.echartsConfig.typeLine')" value="line" />
              <el-option :label="$t('examples.echartsConfig.typePie')" value="pie" />
              <el-option :label="$t('examples.echartsConfig.typeScatter')" value="scatter" />
            </el-select>
          </div>

          <div class="config-row">
            <label class="config-label">{{ $t('examples.echartsConfig.stack') }}</label>
            <el-input
              v-model="series.stack"
              size="small"
              class="config-control"
              :placeholder="$t('examples.echartsConfig.stackPlaceholder')"
            />
          </div>

          <div v-if="series.type === 'line'" class="config-row">
            <label class="config-label">{{ $t('examples.echartsConfig.smooth') }}</label>
            <el-switch
              v-model="(series as any).smooth"
              size="small"
              class="config-control"
            />
          </div>
        </el-card>
      </div>

      <!-- JSON 视图 -->
      <div v-else class="json-view">
        <h4>{{ $t('examples.echartsConfig.fullOptions') }}</h4>
        <pre class="json-code">{{ JSON.stringify(chartOption, null, 2) }}</pre>
      </div>
    </el-card>

    <!-- 图表预览 -->
    <el-card shadow="hover" class="chart-preview">
      <template #header>
        <span>{{ $t('examples.echartsConfig.preview') }}</span>
      </template>
      <div ref="chartRef" class="chart-container"></div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { echartsConfigData, adjustSeriesCount } from '../examples/echarts-config-demo.vario'

const { locale } = useI18n()

// 视图模式
const viewMode = ref<'table' | 'json'>('table')

// Series 数量
const seriesCount = ref(echartsConfigData.seriesCount)

// 图表配置（使用 reactive 以便深度响应）
const chartOption = reactive({ ...echartsConfigData.chartOption })

// 图表容器
const chartRef = ref<HTMLElement | null>(null)

// ECharts 实例
let chartInstance: ECharts | null = null

// 更新 legend
const updateLegend = () => {
  chartOption.legend.data = chartOption.series.map((s: any) => s.name)
}

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return

  if (chartInstance) {
    chartInstance.dispose()
  }

  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

// 更新图表
const updateChart = () => {
  if (!chartInstance) return
  
  chartInstance.setOption(chartOption, true)
}

// 监听 seriesCount 变化
watch(seriesCount, (newCount, oldCount) => {
  if (newCount !== oldCount) {
    const data = { chartOption, seriesCount: newCount }
    adjustSeriesCount(data, newCount)
    nextTick(() => {
      updateChart()
    })
  }
})

// 监听 chartOption 变化
watch(
  () => chartOption,
  () => {
    nextTick(() => {
      updateChart()
    })
  },
  { deep: true }
)

// 监听语言变化
watch(locale, () => {
  nextTick(() => {
    updateChart()
  })
})

// 组件挂载后初始化图表
onMounted(() => {
  nextTick(() => {
    initChart()
  })
})

// 组件卸载时销毁图表
onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style scoped lang="scss">
.echarts-config-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;

  :deep(.echarts-config-demo) {
    h2 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--text-primary);
    }

    .demo-description {
      color: var(--text-secondary);
      margin-bottom: 24px;
      line-height: 1.6;
    }

    .el-card {
      margin-bottom: 20px;

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;

          .el-button {
            display: flex;
            align-items: center;
            gap: 4px;
          }
        }
      }
    }

    // 行内布局样式
    .config-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }

      .config-label {
        min-width: 80px;
        font-weight: 500;
        color: var(--text-secondary);
        text-align: right;
      }

      .config-control {
        flex: 1;
        max-width: 300px;
      }
    }

    // 表格视图
    .table-view {
      h4 {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 16px;
        color: var(--text-primary);
      }

      .series-card {
        margin-bottom: 16px;
        border: 1px solid var(--border-default);

        &:last-child {
          margin-bottom: 0;
        }

        .series-header {
          display: flex;
          justify-content: space-between;
          align-items: center;

          strong {
            color: var(--text-primary);
          }
        }
      }
    }

    // JSON 视图
    .json-view {
      h4 {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 16px;
        color: var(--text-primary);
      }

      .json-code {
        background: var(--bg-code, #f5f7fa);
        border: 1px solid var(--border-default);
        border-radius: 4px;
        padding: 16px;
        overflow: auto;
        max-height: 500px;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.6;
        color: var(--text-primary);
      }
    }

    // 图表预览
    .chart-preview {
      .chart-container {
        min-height: 400px;
      }
    }
  }
}
</style>
