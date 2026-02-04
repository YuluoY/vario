/**
 * ECharts 配置演示数据
 * 由于 Vario Schema 在处理复杂嵌套和动态路径时的限制，
 * 这个示例在 Vue 组件中实现会更合适
 */

export const echartsConfigData = {
  viewMode: 'table', // 'table' | 'json'
  seriesCount: 2,
  chartOption: {
    title: {
      text: 'ECharts Demo'
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['Series 1', 'Series 2']
    },
    xAxis: {
      type: 'category',
      data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: 'Series 1',
        type: 'bar',
        data: [120, 200, 150, 80, 70, 110, 130],
        stack: 'total'
      },
      {
        name: 'Series 2',
        type: 'bar',
        data: [220, 182, 191, 234, 290, 330, 310],
        stack: 'total'
      }
    ]
  }
}

// 辅助函数：根据 seriesCount 调整 series 数组
export function adjustSeriesCount(data: any, count: number) {
  const currentCount = data.chartOption.series.length
  
  if (count > currentCount) {
    // 增加 series
    for (let i = currentCount; i < count; i++) {
      data.chartOption.series.push({
        name: `Series ${i + 1}`,
        type: 'bar',
        data: Array(7).fill(0).map(() => Math.floor(Math.random() * 300)),
        stack: 'total'
      })
    }
  } else if (count < currentCount) {
    // 减少 series
    data.chartOption.series.splice(count)
  }
  
  // 更新 legend
  data.chartOption.legend.data = data.chartOption.series.map((s: any) => s.name)
}
