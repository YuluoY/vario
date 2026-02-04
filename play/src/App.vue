<template>
  <div id="app" class="app" :class="{ 'app--immersive': isHomePage }">
    <!-- Navigation -->
    <nav class="nav" v-if="!isHomePage">
      <div class="nav__content">
        <div class="nav__left">
          <router-link to="/" class="nav__brand">
            <img src="/logo-icon.svg" alt="Vario" class="nav__logo" />
            <h1 class="nav__title">{{ $t('app.title') }}</h1>
          </router-link>
        </div>
        <div class="nav__center">
          <el-menu
            :default-active="activeRoute"
            mode="horizontal"
            :ellipsis="false"
            router
            class="nav__menu"
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
            <el-menu-item index="/playground" route="/playground">
              <el-icon><Edit /></el-icon>
              <span>{{ $t('app.playgroundNav') }}</span>
            </el-menu-item>
          </el-menu>
        </div>
        <div class="nav__right">
          <!-- 导航栏右侧内容已移至浮动操作区 -->
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main :class="['main', { 'main--immersive': isHomePage }]">
      <div :class="isHomePage ? 'main__container--immersive' : 'main__container'">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <!-- Footer -->
    <footer class="footer" v-if="!isHomePage">
      <div class="footer__content">
        <div class="footer__left">
          <p>{{ $t('app.copyright') }}</p>
          <el-tag type="primary" size="small" class="footer__version">v0.1.0</el-tag>
        </div>
        <div class="footer__links">
          <a href="https://github.com/YuluoY/vario" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a :href="docsUrl" @click.prevent="goToDocs">{{ $t('app.docsNav') }}</a>
        </div>
      </div>
    </footer>

    <!-- 浮动操作区 - 固定在右下角，纵向排列 -->
    <div class="fab">
      <div class="fab__container">
        <!-- 语言切换 -->
        <el-button 
          @click="handleLanguageChange"
          circle
          class="fab__button"
          :title="$t('app.switchLanguage')"
          :aria-label="$t('app.switchLanguage')"
        >
          {{ currentLanguageCode }}
        </el-button>
        
        <!-- 主题切换 -->
        <el-button 
          :icon="isDark ? Sunny : Moon" 
          @click="handleThemeChange"
          circle
          class="fab__button fab__button--primary"
          :title="$t('app.switchTheme')"
          :aria-label="$t('app.switchTheme')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { HomeFilled, DocumentChecked, Connection, Collection, Timer, Moon, Sunny, Edit } from '@element-plus/icons-vue'

const LOCAL_THEME_KEY = 'vario-theme'

const route = useRoute()
// 文档链接：生产环境使用构建后的静态文件，开发环境使用 VitePress dev server
const getDocsUrl = () => {
  if (import.meta.env.DEV) {
    // 开发环境：使用 VitePress dev server (运行在 5174 端口)
    return import.meta.env.VITE_DOCS_URL || 'http://localhost:5174/docs/'
  } else {
    // 生产环境：使用相对路径
    const base = import.meta.env.BASE_URL || '/'
    return base + 'docs/'
  }
}
const docsUrl = getDocsUrl()

const goToDocs = (event?: Event) => { 
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  
  const url = getDocsUrl()
  
  if (import.meta.env.DEV) {
    // 开发环境：在新窗口打开
    const newWindow = window.open(url, '_blank')
    if (!newWindow) {
      // 如果弹窗被阻止，尝试在当前窗口打开
      window.location.href = url
    }
  } else {
    // 生产环境：直接跳转
    window.location.href = url
  }
}
const { locale } = useI18n()

const activeRoute = computed(() => route.path)

const isHomePage = computed(() => route.path === '/')

const isDark = ref(false)

// 当前语言代码（CN/EN）
const currentLanguageCode = computed(() => {
  return locale.value === 'zh-CN' ? 'CN' : 'EN'
})

// 从localStorage读取主题设置，如果没有则默认使用暗色主题
onMounted(() => {
  let theme = localStorage.getItem(LOCAL_THEME_KEY)
  
  // 如果没有保存的主题设置，默认使用暗色主题
  if (!theme) {
    theme = 'dark'
  }
  
  const html = document.documentElement
  isDark.value = theme === 'dark'
  html.setAttribute('data-theme', theme)
  if (theme === 'dark') {
    html.classList.add('dark')
  }
  
  // 保存到 localStorage（首次访问时）
  if (!localStorage.getItem(LOCAL_THEME_KEY)) {
    localStorage.setItem(LOCAL_THEME_KEY, theme)
  }
})

// 监听主题变化
watch(isDark, (newVal) => {
  const html = document.documentElement
  const theme = newVal ? 'dark' : 'light'
  html.setAttribute('data-theme', theme)
  if (newVal) {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
  localStorage.setItem(LOCAL_THEME_KEY, theme)
})

const handleLanguageChange = () => {
  locale.value = locale.value === 'zh-CN' ? 'en' : 'zh-CN'
  // 不显示 message
}

const handleThemeChange = () => {
  isDark.value = !isDark.value
  // 不显示 message
}
</script>

<style scoped lang="scss">
@use '@src/styles/abstracts/variables' as *;
@use '@src/styles/abstracts/mixins' as *;

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-base);
  transition: background-color $transition-base;
  position: relative;
}

// ============================================
// Floating Action Buttons (FAB)
// 固定在右下角，纵向排列
// ============================================

.fab {
  position: fixed;
  right: 20px;
  bottom: 100px; // 确保在 footer 之上（footer 高度约 88px + 间距 12px）
  z-index: $z-index-fixed;
  pointer-events: none; // 容器不拦截事件

  @include respond-below(xs) {
    right: $spacing-md;
    bottom: 90px; // 移动端 footer 高度约 72px + 间距 18px
  }

  &__container {
    display: flex;
    flex-direction: column;
    align-items: center; // 居中对齐
    gap: $spacing-md;
    pointer-events: auto; // 子元素可点击
  }

  &__button {
    width: 48px;
    height: 48px;
    min-width: 48px;
    max-width: 48px;
    border-radius: $radius-full;
    background: var(--bg-card);
    border: 1px solid var(--border-default);
    color: var(--text-primary);
    box-shadow: var(--shadow-md);
    display: inline-flex; // 使用 inline-flex 确保尺寸一致
    align-items: center;
    justify-content: center;
    transition: all $transition-base;
    @include focus-visible;
    font-size: $font-size-small-desktop;
    font-weight: 600;
    flex-shrink: 0;
    margin: 0;
    padding: 0;
    
    // 覆盖 Element Plus 默认样式
    :deep(.el-icon) {
      font-size: 20px;
    }
    
    &:hover {
      background: var(--bg-hover);
      border-color: var(--primary-base);
      color: var(--primary-base);
      box-shadow: var(--shadow-lg);
      transform: translateY(-2px);
    }
    
    &:active {
      transform: translateY(0);
    }
    
    &--primary {
      background: var(--primary-base);
      border-color: var(--primary-base);
      color: white;
      
      &:hover {
        background: var(--primary-hover);
        border-color: var(--primary-hover);
        color: white;
      }
    }
    
    @include respond-below(xs) {
      width: 44px;
      height: 44px;
      min-width: 44px;
      max-width: 44px;
      font-size: $font-size-small-mobile;
      
      :deep(.el-icon) {
        font-size: 18px;
      }
    }
  }
}

// Immersive Home Styles overrides
#app.app--immersive {
  max-width: none !important;
  padding: 0 !important;
  margin: 0 !important;
  width: 100%;
}

.main--immersive {
  padding: 0;
  max-width: none;
  flex: 1;
  display: block; 
}

.main__container--immersive {
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  max-width: none;
}
</style>
