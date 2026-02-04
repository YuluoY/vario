<template>
  <div class="schema-query-demo">
    <component :is="vnode" />
  </div>
</template>

<script setup lang="ts">
import { useVario } from '@variojs/vue'
import { ElMessage } from 'element-plus'
import schemaQueryDemo from '../examples/schema-query-demo.vario'
import { reactive } from 'vue'

// 初始化状态
const state = reactive({
  formData: {
    username: '',
    email: '',
    password: '',
    age: undefined
  },
  queryResult: false,
  queryResultTitle: '',
  queryResultType: 'info',
  queryResultMessage: '',
  activeExample: ['findById']
})

// 初始化 useVario
const { vnode, findById, findAll } = useVario(schemaQueryDemo, {
  state,
  methods: {
    // 测试通过 ID 查找
    testFindById() {
      const emailNode = findById('email-input')
      
      if (emailNode) {
        state.queryResult = true
        state.queryResultTitle = '✅ 查找成功'
        state.queryResultType = 'success'
        state.queryResultMessage = `找到节点: type="${emailNode.node.type}", id="${emailNode.node.id}", path="${emailNode.path}"`
        
        ElMessage.success({
          message: '成功找到 email-input 节点',
          duration: 2000
        })
        
        // 高亮显示
        emailNode.patch({
          props: {
            ...emailNode.node.props,
            class: 'highlight-input'
          }
        })
        
        setTimeout(() => {
          emailNode.patch({
            props: {
              ...emailNode.node.props,
              class: ''
            }
          })
        }, 2000)
      } else {
        state.queryResult = true
        state.queryResultTitle = '❌ 查找失败'
        state.queryResultType = 'error'
        state.queryResultMessage = '未找到 email-input 节点'
        
        ElMessage.error('未找到节点')
      }
    },

    // 测试查找所有输入框
    testFindAllInputs() {
      const inputs = findAll(node => 
        node.type === 'el-input' || 
        node.type === 'el-input-number'
      )
      
      state.queryResult = true
      state.queryResultTitle = '✅ 查找成功'
      state.queryResultType = 'success'
      state.queryResultMessage = `找到 ${inputs.length} 个输入框:\n${inputs.map(w => `- ${w.node.type} (id: ${w.node.id}, path: ${w.path})`).join('\n')}`
      
      ElMessage.success({
        message: `找到 ${inputs.length} 个输入框`,
        duration: 2000
      })
      
      console.log('找到的输入框:', inputs.map(w => ({
        type: w.node.type,
        id: w.node.id,
        path: w.path
      })))
    },

    // 测试禁用所有输入
    testDisableAll() {
      const inputs = findAll(node => 
        node.type === 'el-input' || 
        node.type === 'el-input-number'
      )
      
      inputs.forEach(wrapper => {
        wrapper.patch({
          props: {
            ...wrapper.node.props,
            disabled: true
          }
        })
      })
      
      state.queryResult = true
      state.queryResultTitle = '🔒 禁用成功'
      state.queryResultType = 'warning'
      state.queryResultMessage = `已禁用 ${inputs.length} 个输入框`
      
      ElMessage.warning({
        message: '已禁用所有输入框',
        duration: 2000
      })
    },

    // 测试启用所有输入
    testEnableAll() {
      const inputs = findAll(node => 
        node.type === 'el-input' || 
        node.type === 'el-input-number'
      )
      
      inputs.forEach(wrapper => {
        wrapper.patch({
          props: {
            ...wrapper.node.props,
            disabled: false
          }
        })
      })
      
      state.queryResult = true
      state.queryResultTitle = '🔓 启用成功'
      state.queryResultType = 'info'
      state.queryResultMessage = `已启用 ${inputs.length} 个输入框`
      
      ElMessage.info({
        message: '已启用所有输入框',
        duration: 2000
      })
    },

    // 测试获取父节点
    testGetParent() {
      const usernameInput = findById('username-input')
      
      if (usernameInput) {
        const parent = usernameInput.parent()
        
        if (parent) {
          state.queryResult = true
          state.queryResultTitle = '✅ 获取父节点成功'
          state.queryResultType = 'success'
          state.queryResultMessage = `当前节点: ${usernameInput.node.type} (${usernameInput.path})\n父节点: ${parent.node.type} (${parent.path})`
          
          ElMessage.success({
            message: '成功获取父节点',
            duration: 2000
          })
          
          console.log('当前节点:', {
            type: usernameInput.node.type,
            id: usernameInput.node.id,
            path: usernameInput.path
          })
          console.log('父节点:', {
            type: parent.node.type,
            id: parent.node.id,
            path: parent.path
          })
        } else {
          state.queryResult = true
          state.queryResultTitle = '⚠️ 父节点不存在'
          state.queryResultType = 'warning'
          state.queryResultMessage = '当前节点已经是根节点'
          
          ElMessage.warning('已经是根节点')
        }
      }
    }
  }
})
</script>

<style scoped>
.schema-query-demo {
  padding: 20px;
}

:deep(.demo-container) {
  max-width: 1200px;
  margin: 0 auto;
}

:deep(.demo-header) {
  margin-bottom: 24px;
  text-align: center;
}

:deep(.demo-header h2) {
  font-size: 28px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 12px;
}

:deep(.demo-header .description) {
  font-size: 16px;
  color: #606266;
}

:deep(.el-card) {
  margin-bottom: 20px;
}

:deep(.stats-grid) {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

:deep(.stat-item) {
  text-align: center;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

:deep(.stat-label) {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

:deep(.stat-value) {
  font-size: 32px;
  font-weight: 600;
  color: #409eff;
}

:deep(.button-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

:deep(.empty-state) {
  padding: 40px 0;
}

:deep(.el-alert) {
  white-space: pre-wrap;
}

:deep(.code-card pre) {
  margin: 0;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
  overflow-x: auto;
}

:deep(.code-card code) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #2c3e50;
}

:deep(.highlight-input) {
  animation: highlight 2s ease-in-out;
}

@keyframes highlight {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(64, 158, 255, 0);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.4);
  }
}
</style>
