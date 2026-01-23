<template>
  <div class="home-view">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">{{ $t('home.welcomeTitle') }}</h1>
        <p class="hero-subtitle">
          {{ $t('home.welcomeSubtitle') }}
        </p>
        <div class="hero-actions">
          <el-button type="primary" size="large" @click="navigateToTests">
            <el-icon class="mr-2"><DocumentChecked /></el-icon>
            {{ $t('home.startTesting') }}
          </el-button>
          <el-button size="large" @click="navigateToExamples">
            <el-icon class="mr-2"><Collection /></el-icon>
            {{ $t('home.viewExamples') }}
          </el-button>
        </div>
      </div>
      <div class="hero-illustration">
        <el-icon :size="200" color="#8B5CF6"><Connection /></el-icon>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="features-section">
      <h2 class="section-title">{{ $t('home.keyFeatures') }}</h2>
      <el-row :gutter="24" class="features-grid">
        <el-col :xs="24" :sm="12" :md="8" v-for="feature in features" :key="feature.title">
          <div class="feature-card">
            <div class="feature-icon">
              <component :is="feature.icon" :size="40" />
            </div>
            <h3 class="feature-title">{{ feature.title }}</h3>
            <p class="feature-description">{{ feature.description }}</p>
          </div>
        </el-col>
      </el-row>
    </section>

    <!-- Quick Stats -->
    <section class="stats-section">
      <el-row :gutter="24" class="stats-grid">
        <el-col :xs="12" :sm="6" v-for="stat in stats" :key="stat.label">
          <div class="stat-card">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </el-col>
      </el-row>
    </section>

    <!-- Getting Started -->
    <section class="getting-started-section">
      <h2 class="section-title">{{ $t('home.gettingStarted') }}</h2>
      <el-card class="getting-started-card">
        <el-timeline>
          <el-timeline-item
            v-for="(step, index) in gettingStartedSteps"
            :key="index"
            :timestamp="step.timestamp"
            placement="top"
          >
            <el-card shadow="hover">
              <h4>{{ step.title }}</h4>
              <p>{{ step.description }}</p>
              <el-button v-if="step.action" type="primary" link @click="step.action">
                {{ step.actionText }} →
              </el-button>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </el-card>
    </section>

    <!-- Status Section -->
    <section class="status-section">
      <h2 class="section-title">{{ $t('home.systemStatus') }}</h2>
      <el-card>
        <el-row :gutter="24">
          <el-col :xs="24" :md="12">
            <div class="status-item">
              <span class="status-label">{{ $t('home.varioCore') }}:</span>
              <el-tag type="success" effect="dark">{{ $t('home.statusReady') }}</el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">{{ $t('home.varioSchema') }}:</span>
              <el-tag type="success" effect="dark">{{ $t('home.statusReady') }}</el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">{{ $t('home.varioVue') }}:</span>
              <el-tag type="success" effect="dark">{{ $t('home.statusReady') }}</el-tag>
            </div>
          </el-col>
          <el-col :xs="24" :md="12">
            <div class="status-item">
              <span class="status-label">{{ $t('home.expressionSystem') }}:</span>
              <el-tag type="success" effect="dark">{{ $t('home.statusReady') }}</el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">{{ $t('home.instructionVm') }}:</span>
              <el-tag type="success" effect="dark">{{ $t('home.statusReady') }}</el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">{{ $t('home.pluginSystem') }}:</span>
              <el-tag type="warning" effect="dark">{{ $t('home.statusInProgress') }}</el-tag>
            </div>
          </el-col>
        </el-row>
      </el-card>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  DocumentChecked,
  Collection,
  Connection,
  Lightning,
  Lock,
  Box,
  Setting
} from '@element-plus/icons-vue'

const { t } = useI18n()
const router = useRouter()

const navigateToTests = () => {
  router.push('/unit-tests')
}

const navigateToExamples = () => {
  router.push('/examples')
}

const features = ref([
  {
    icon: Lightning,
    title: t('home.feature1Title'),
    description: t('home.feature1Desc')
  },
  {
    icon: Lock,
    title: t('home.feature2Title'),
    description: t('home.feature2Desc')
  },
  {
    icon: Box,
    title: t('home.feature3Title'),
    description: t('home.feature3Desc')
  },
  {
    icon: Setting,
    title: t('home.feature4Title'),
    description: t('home.feature4Desc')
  },
  {
    icon: Connection,
    title: t('home.feature5Title'),
    description: t('home.feature5Desc')
  },
  {
    icon: DocumentChecked,
    title: t('home.feature6Title'),
    description: t('home.feature6Desc')
  }
])

const stats = ref([
  { label: t('home.stat1Label'), value: '5' },
  { label: t('home.stat2Label'), value: '50+' },
  { label: t('home.stat3Label'), value: '20+' },
  { label: t('home.stat4Label'), value: '100%' }
])

const gettingStartedSteps = ref([
  {
    timestamp: 'Step 1',
    title: t('home.step1Title'),
    description: t('home.step1Desc'),
    action: navigateToTests,
    actionText: t('home.step1Action')
  },
  {
    timestamp: 'Step 2',
    title: t('home.step2Title'),
    description: t('home.step2Desc'),
    action: () => router.push('/integration-tests'),
    actionText: t('home.step2Action')
  },
  {
    timestamp: 'Step 3',
    title: t('home.step3Title'),
    description: t('home.step3Desc'),
    action: navigateToExamples,
    actionText: t('home.step3Action')
  }
])
</script>

<style scoped lang="scss">
.home-view {
  animation: fadeIn 0.5s ease;
}

.hero-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  margin-bottom: var(--space-16);
  padding: var(--space-12);
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: var(--radius-lg);
}

.hero-content {
  flex: 1;
  max-width: 600px;
}

.hero-title {
  font-size: var(--font-size-5xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-6);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-8);
  line-height: var(--line-height-relaxed);
}

.hero-actions {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.hero-illustration {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.section-title {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  text-align: center;
  margin-bottom: var(--space-12);
}

.features-section {
  margin-bottom: var(--space-16);
}

.features-grid {
  margin-bottom: var(--space-8);
}

.feature-card {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-8);
  height: 100%;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }
}

.feature-icon {
  width: 80px;
  height: 80px;
  background: var(--color-primary-light);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-6);
  color: var(--color-primary);
}

.feature-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-3);
}

.feature-description {
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

.stats-section {
  margin-bottom: var(--space-16);
}

.stats-grid {
  margin-bottom: var(--space-8);
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: var(--radius-lg);
  padding: var(--space-8);
  text-align: center;
  color: white;
  box-shadow: var(--shadow-md);

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }
}

.stat-value {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-2);
}

.stat-label {
  font-size: var(--font-size-sm);
  opacity: 0.9;
}

.getting-started-section {
  margin-bottom: var(--space-16);
}

.getting-started-card {
  :deep(.el-timeline-item__wrapper) {
    padding-left: var(--space-4);
  }
}

.status-section {
  margin-bottom: var(--space-16);
}

.status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.status-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
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

.mr-2 {
  margin-right: var(--space-2);
}

// Responsive
@media (max-width: 768px) {
  .hero-section {
    flex-direction: column;
    text-align: center;
    padding: var(--space-8);
  }

  .hero-title {
    font-size: var(--font-size-3xl);
  }

  .hero-subtitle {
    font-size: var(--font-size-base);
  }

  .hero-actions {
    justify-content: center;
  }

  .hero-illustration {
    display: none;
  }

  .section-title {
    font-size: var(--font-size-3xl);
  }

  .stat-value {
    font-size: var(--font-size-3xl);
  }
}
</style>
