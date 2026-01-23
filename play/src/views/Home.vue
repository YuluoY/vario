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
        <img src="/logo-icon.svg" alt="Vario" class="hero-logo" />
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
import { computed } from 'vue'
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

const features = computed(() => [
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

const stats = computed(() => [
  { label: t('home.stat1Label'), value: '5' },
  { label: t('home.stat2Label'), value: '50+' },
  { label: t('home.stat3Label'), value: '20+' },
  { label: t('home.stat4Label'), value: '100%' }
])

const gettingStartedSteps = computed(() => [
  {
    timestamp: t('home.step1Timestamp'),
    title: t('home.step1Title'),
    description: t('home.step1Desc'),
    action: navigateToTests,
    actionText: t('home.step1Action')
  },
  {
    timestamp: t('home.step2Timestamp'),
    title: t('home.step2Title'),
    description: t('home.step2Desc'),
    action: () => router.push('/integration-tests'),
    actionText: t('home.step2Action')
  },
  {
    timestamp: t('home.step3Timestamp'),
    title: t('home.step3Title'),
    description: t('home.step3Desc'),
    action: navigateToExamples,
    actionText: t('home.step3Action')
  }
])
</script>

<style scoped lang="scss">
@use '@src/styles/abstracts/variables' as *;
@use '@src/styles/abstracts/mixins' as *;

.home-view {
  animation: fadeIn 0.5s ease;
}

.hero-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-xl;
  margin-bottom: $spacing-xxl;
  padding: $spacing-xl;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: $radius-lg;
  @include transition-opacity($transition-base);
  
  @include respond-below(xs) {
    flex-direction: column;
    text-align: center;
    padding: $spacing-lg;
    gap: $spacing-lg;
  }
}

.hero-content {
  flex: 1;
  max-width: 600px;
}

.hero-title {
  @include typography-h1;
  margin-bottom: $spacing-md;
  background: linear-gradient(135deg, var(--primary-base) 0%, var(--primary-hover) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  @include respond-below(xs) {
    font-size: $font-size-h2-mobile;
  }
}

.hero-subtitle {
  @include typography-body;
  font-size: $font-size-h4-desktop;
  color: var(--text-secondary);
  margin-bottom: $spacing-lg;
  line-height: $line-height-body;
  
  @include respond-below(xs) {
    font-size: $font-size-body-mobile;
  }
}

.hero-actions {
  display: flex;
  gap: $spacing-md;
  flex-wrap: wrap;
  
  @include respond-below(xs) {
    justify-content: center;
  }
}

.hero-illustration {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  
  @include respond-below(xs) {
    display: none;
  }
}

.hero-logo {
  width: 200px;
  height: 200px;
  animation: float 3s ease-in-out infinite;
  filter: drop-shadow(0 10px 20px rgba(59, 130, 246, 0.2));
  @include transition-transform($transition-slow);
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.section-title {
  @include typography-h2;
  text-align: center;
  margin-bottom: $spacing-xl;
  color: var(--text-primary);
}

.features-section {
  margin-bottom: $spacing-xxl;
}

.features-grid {
  margin-bottom: $spacing-lg;
  
  // 为每个卡片添加上下间距
  :deep(.el-col) {
    margin-top: $spacing-md;
    margin-bottom: $spacing-md;
  }
}

.feature-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: $radius-lg;
  padding: $spacing-lg;
  height: 100%;
  @include transition-transform($transition-base);
  box-shadow: var(--shadow-sm);

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
    border-color: var(--primary-base);
  }
}

.feature-icon {
  width: 80px;
  height: 80px;
  background: var(--bg-hover);
  border-radius: $radius-full;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $spacing-md;
  color: var(--primary-base);
  @include transition-transform($transition-base);
  
  .feature-card:hover & {
    transform: scale(1.1);
  }
}

.feature-title {
  @include typography-h4;
  margin-bottom: $spacing-sm;
  color: var(--text-primary);
}

.feature-description {
  @include typography-body;
  color: var(--text-secondary);
  line-height: $line-height-body;
}

.stats-section {
  margin-bottom: $spacing-xxl;
}

.stats-grid {
  margin-bottom: $spacing-lg;
}

.stat-card {
  background: linear-gradient(135deg, var(--primary-base) 0%, var(--primary-hover) 100%);
  border-radius: $radius-lg;
  padding: $spacing-lg;
  text-align: center;
  color: white;
  box-shadow: var(--shadow-md);
  @include transition-transform($transition-base);

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }
}

.stat-value {
  @include typography-h2;
  margin-bottom: $spacing-xs;
  color: white;
  
  @include respond-below(xs) {
    font-size: $font-size-h3-mobile;
  }
}

.stat-label {
  @include typography-body;
  font-size: $font-size-small-desktop;
  opacity: 0.95;
  color: rgba(255, 255, 255, 0.9);
}

.getting-started-section {
  margin-bottom: $spacing-xxl;
}

.getting-started-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  
  :deep(.el-timeline-item__wrapper) {
    padding-left: $spacing-md;
  }
}

.status-section {
  margin-bottom: $spacing-xxl;
}

.status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md 0;
  border-bottom: 1px solid var(--border-default);

  &:last-child {
    border-bottom: none;
  }
}

.status-label {
  @include typography-body;
  font-weight: 600;
  color: var(--text-primary);
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
  margin-right: $spacing-xs;
}
</style>
