<template>
  <div class="unit-tests-view">

    <el-tabs v-model="activeTab" type="border-card" class="test-tabs">
      <!-- Vue Integration Tests -->
      <el-tab-pane :label="$t('unitTests.vueIntegration')" name="vue">
        <VueIntegrationTests />
      </el-tab-pane>

      <!-- Runtime Context Tests -->
      <el-tab-pane :label="$t('unitTests.runtimeContext')" name="context">
        <RuntimeContextTests />
      </el-tab-pane>

      <!-- Expression Tests -->
      <el-tab-pane :label="$t('unitTests.expressionSystemNav')" name="expression">
        <ExpressionTests />
      </el-tab-pane>

      <!-- Instruction Tests -->
      <el-tab-pane :label="$t('unitTests.instructionVm')" name="instruction">
        <InstructionTests />
      </el-tab-pane>

      <!-- Schema Tests -->
      <el-tab-pane :label="$t('unitTests.schemaNav')" name="schema">
        <SchemaTests />
      </el-tab-pane>

      <!-- Performance Tests -->
      <el-tab-pane :label="$t('unitTests.performanceNav')" name="performance">
        <PerformanceTests />
      </el-tab-pane>

      <!-- Security Tests -->
      <el-tab-pane :label="$t('unitTests.securityNav')" name="security">
        <SecurityTests />
      </el-tab-pane>

      <!-- Schema Query Tests -->
      <el-tab-pane label="Schema 查询" name="schema-query">
        <SchemaQueryTests />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import VueIntegrationTests from '@src/components/VueIntegrationTests.vue'
import RuntimeContextTests from '@src/components/RuntimeContextTests.vue'
import ExpressionTests from '@src/components/ExpressionTests.vue'
import InstructionTests from '@src/components/InstructionTests.vue'
import SchemaTests from '@src/components/SchemaTests.vue'
import PerformanceTests from '@src/components/PerformanceTests.vue'
import SecurityTests from '@src/components/SecurityTests.vue'
import SchemaQueryTests from '@src/components/SchemaQueryTests.vue'

const activeTab = ref('vue')
</script>

<style scoped lang="scss">
@use '@src/styles/abstracts/variables' as *;
@use '@src/styles/abstracts/mixins' as *;

.unit-tests-view {
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
    margin-bottom: 0;
    
    @include respond-below(xs) {
      font-size: $font-size-body-mobile;
    }
  }
}

.test-tabs {
  min-height: 600px;
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
