<template>
  <div class="unit-tests-view">
    <div class="page-header">
      <h1>{{ $t('unitTests.title') }}</h1>
      <p>{{ $t('unitTests.subtitle') }}</p>
    </div>

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

const activeTab = ref('vue')
</script>

<style scoped lang="scss">
.unit-tests-view {
  animation: fadeIn 0.5s ease;
}

.page-header {
  margin-bottom: var(--space-8);
}

.page-header h1 {
  font-size: var(--font-size-4xl);
  margin-bottom: var(--space-2);
}

.page-header p {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  margin-bottom: 0;
}

.test-tabs {
  min-height: 600px;

  :deep(.el-tabs__content) {
    padding: var(--space-6);
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
