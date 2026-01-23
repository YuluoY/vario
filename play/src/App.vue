<template>
  <div id="app" class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="container header-content">
        <div class="header-left">
          <h1 class="app-title">{{ $t('app.title') }}</h1>
          <p class="app-subtitle">{{ $t('app.subtitle') }}</p>
        </div>
        <div class="header-right">
          <el-button 
            :icon="Switch" 
            @click="switchLanguage"
            class="language-switcher"
          >
            {{ languageMap[locale as keyof typeof languageMap] }}
          </el-button>
          <el-tag type="primary" size="large">v0.1.0</el-tag>
        </div>
      </div>
    </header>

    <!-- Navigation -->
    <nav class="app-nav">
      <div class="container nav-content">
        <el-menu
          :default-active="activeRoute"
          mode="horizontal"
          :ellipsis="false"
          router
          class="nav-menu"
        >
          <el-menu-item index="/" route="/">
            <el-icon><HomeFilled /></el-icon>
            <span>{{ $t('app.home') }}</span>
          </el-menu-item>
          <el-menu-item index="/unit-tests" route="/unit-tests">
            <el-icon><DocumentChecked /></el-icon>
            <span>{{ $t('app.unitTestsNav') }}</span>
          </el-menu-item>
          <el-menu-item index="/integration-tests" route="/integration-tests">
            <el-icon><Connection /></el-icon>
            <span>{{ $t('app.integrationTestsNav') }}</span>
          </el-menu-item>
          <el-menu-item index="/performance-tests" route="/performance-tests">
            <el-icon><Timer /></el-icon>
            <span>{{ $t('app.performanceTestsNav') }}</span>
          </el-menu-item>
          <el-menu-item index="/examples" route="/examples">
            <el-icon><Collection /></el-icon>
            <span>{{ $t('app.examplesNav') }}</span>
          </el-menu-item>
        </el-menu>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="app-main">
      <div class="container">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <div class="container footer-content">
        <p>{{ $t('app.copyright') }}</p>
        <div class="footer-links">
          <a href="https://github.com/vario-project/vario" target="_blank">GitHub</a>
          <a href="https://vario.dev/docs" target="_blank">Documentation</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { HomeFilled, DocumentChecked, Connection, Collection, Switch, Timer } from '@element-plus/icons-vue'
// 注意：ElMessage 是 Element Plus 提供的全局方法，通过 app.use(ElementPlus) 注册
// 这里直接导入使用是合理的，因为它是工具方法而非组件
import { ElMessage } from 'element-plus'

const route = useRoute()
const { locale, t } = useI18n()

const activeRoute = computed(() => route.path)

const languageMap = {
  'zh-CN': '中文',
  'en': 'English'
}

const switchLanguage = () => {
  locale.value = locale.value === 'zh-CN' ? 'en' : 'zh-CN'
  ElMessage.success(t('app.switchLanguage') + ': ' + languageMap[locale.value as keyof typeof languageMap])
}
</script>

<style scoped lang="scss">
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: var(--space-8) 0;
  box-shadow: var(--shadow-md);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  .app-title {
    font-size: var(--font-size-4xl);
    margin: 0;
    font-weight: var(--font-weight-bold);
  }

  .app-subtitle {
    font-size: var(--font-size-lg);
    color: rgba(255, 255, 255, 0.9);
    margin: var(--space-2) 0 0 0;
  }
}

.app-nav {
  background: white;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow-sm);
}

.nav-content {
  padding: 0 var(--space-6);
}

.nav-menu {
  border-bottom: none;
  background: transparent;
}

.app-main {
  flex: 1;
  padding: var(--space-8) 0;
}

.app-footer {
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  padding: var(--space-6) 0;
  margin-top: auto;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--color-text-secondary);
}

.footer-links {
  display: flex;
  gap: var(--space-6);

  a {
    color: var(--color-text-secondary);
    transition: color var(--transition-fast);

    &:hover {
      color: var(--color-primary);
    }
  }
}

.language-switcher {
  margin-right: var(--space-4);
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-base), transform var(--transition-base);
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

// Responsive
@media (max-width: 768px) {
  .app-header {
    padding: var(--space-6) 0;
  }

  .header-content {
    flex-direction: column;
    gap: var(--space-4);
    text-align: center;
  }

  .app-title {
    font-size: var(--font-size-3xl);
  }

  .app-subtitle {
    font-size: var(--font-size-base);
  }

  .nav-menu {
    overflow-x: auto;
  }

  .footer-content {
    flex-direction: column;
    gap: var(--space-4);
    text-align: center;
  }

  .footer-links {
    flex-direction: column;
    gap: var(--space-2);
  }
}
</style>
