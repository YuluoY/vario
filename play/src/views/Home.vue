<template>
  <div class="home-container">
    <!-- 粒子背景 -->
    <ParticleBackground :speed="0.2" :particle-count="200" />

    <!-- 视差装饰层 -->
    <div class="parallax-decor" aria-hidden="true">
      <div class="decor-glow-1" data-parallax="0.3"></div>
      <div class="decor-glow-2" data-parallax="0.5"></div>
    </div>

    <!-- 主内容层 -->
    <div class="content-layer">
      <!-- ===== 第 1 屏：Hero ===== -->
      <section class="section hero" id="hero">
        <div class="hero-content">
          <div class="hero-badge" data-animate="fade-in">
            <span class="badge-dot"></span>
            {{ $t('home.hero.eyebrow') }}
          </div>

          <h1 class="hero-title" data-animate="scale-in">
            <span class="title-char" v-for="(char, i) in titleChars" :key="i" :style="{ animationDelay: `${i * 0.05}s` }">
              {{ char }}
            </span>
          </h1>

          <p class="hero-subtitle" data-animate="fade-in-up" style="animation-delay: 0.4s">
            {{ $t('home.hero.subtitle') }}
          </p>

          <p class="hero-desc" data-animate="fade-in-up" style="animation-delay: 0.5s">
            {{ $t('home.hero.desc') }}
          </p>

          <div class="hero-actions" data-animate="fade-in-up" style="animation-delay: 0.6s">
            <a class="v-btn v-btn--primary" :href="docsUrl">
              <span class="btn-icon">📚</span>
              {{ $t('home.hero.docs') }}
            </a>
            <a class="v-btn" :href="$t('home.hero.githubUrl')" target="_blank" rel="noreferrer">
              <span class="btn-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </span>
              {{ $t('home.hero.github') }}
            </a>
            <button class="v-btn v-btn--ghost" @click="$router.push('/playground')">
              <span class="btn-icon">▶️</span>
              {{ $t('home.hero.demo') }}
            </button>
          </div>

          <div class="hero-stats" data-animate="fade-in-up" style="animation-delay: 0.7s">
            <div class="stat-item">
              <span class="stat-value">{{ $t('home.hero.stat1Value') }}</span>
              <span class="stat-label">{{ $t('home.hero.stat1Label') }}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">{{ $t('home.hero.stat2Value') }}</span>
              <span class="stat-label">{{ $t('home.hero.stat2Label') }}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">{{ $t('home.hero.stat3Value') }}</span>
              <span class="stat-label">{{ $t('home.hero.stat3Label') }}</span>
            </div>
          </div>
        </div>

        <div class="scroll-indicator">
          <svg class="scroll-arrow" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </div>
      </section>

      <!-- ===== 第 2 屏：为什么需要 Vario ===== -->
      <section class="section why" id="why">
        <h2 class="v-title-section">{{ $t('home.why.title') }}</h2>

        <div class="why-grid">
          <div class="why-panel why-panel--problem" data-animate="slide-left">
            <div class="panel-header">
              <span class="panel-icon">⚠️</span>
              <span class="panel-label">{{ $t('home.why.painLabel') }}</span>
            </div>
            <ul class="problem-list">
              <li v-for="(item, i) in painPoints" :key="i" class="problem-item">
                <span class="item-x">✕</span>
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>

          <div class="why-divider" data-animate="fade-in">
            <div class="divider-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </div>

          <div class="why-panel why-panel--solution" data-animate="slide-right">
            <div class="panel-header">
              <span class="panel-icon">✨</span>
              <span class="panel-label">Vario</span>
            </div>
            <ul class="solution-list">
              <li v-for="(item, i) in solutions" :key="i" class="solution-item">
                <span class="item-check">✓</span>
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ===== 第 3 屏：核心能力 ===== -->
      <section class="section skills" id="skills">
        <h2 class="v-title-section">{{ $t('home.skills.title') }}</h2>

        <div class="skills-grid">
          <div
            v-for="(skill, i) in skills"
            :key="i"
            class="skill-card"
            :class="`skill-card--${i}`"
            :data-animate="`fade-in-up`"
            :style="{ animationDelay: `${i * 0.1}s` }"
          >
            <div class="skill-icon-wrapper">
              <span class="skill-number">0{{ i + 1 }}</span>
              <span class="skill-icon">{{ skill.icon }}</span>
            </div>
            <h3 class="skill-title">{{ skill.title }}</h3>
            <p class="skill-desc">{{ skill.desc }}</p>
          </div>
        </div>
      </section>

      <!-- ===== 第 4 屏：架构分层 ===== -->
      <section class="section architecture" id="architecture">
        <h2 class="v-title-section">{{ $t('home.arch.title') }}</h2>

        <div class="arch-layout">
          <div class="arch-content">
            <div
              v-for="(layer, i) in archLayers"
              :key="i"
              class="arch-step"
              :class="{ active: activeArchStep === i }"
              :data-step="i"
              @mouseenter="activeArchStep = i"
            >
              <div class="step-badge" :style="{ background: layer.color }">
                {{ layer.abbr }}
              </div>
              <div class="step-content">
                <h3 class="step-title">{{ layer.title }}</h3>
                <p class="step-desc">{{ layer.desc }}</p>
                <ul class="step-features">
                  <li v-for="(feat, j) in layer.features" :key="j">{{ feat }}</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="arch-visual">
            <div class="arch-diagram">
              <div
                v-for="(layer, i) in archLayers"
                :key="i"
                class="arch-layer"
                :class="{ active: activeArchStep === i }"
                :style="{ '--layer-color': layer.color }"
                @mouseenter="activeArchStep = i"
              >
                <div class="layer-indicator" :style="{ background: layer.color }"></div>
                <div class="layer-content">
                  <span class="layer-name">{{ layer.name }}</span>
                  <span class="layer-abbr">{{ layer.abbr }}</span>
                </div>
              </div>

              <svg class="arch-connections" viewBox="0 0 100 120" preserveAspectRatio="none">
                <line
                  v-for="i in 2"
                  :key="i"
                  x1="50"
                  :y1="(i - 1) * 40 + 20"
                  x2="50"
                  :y2="i * 40 + 20"
                  stroke="rgba(37, 99, 235, 0.3)"
                  stroke-width="2"
                  stroke-dasharray="4 4"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 第 5 屏：使用方式 ===== -->
      <section class="section usage" id="usage">
        <h2 class="v-title-section">{{ $t('home.usage.title') }}</h2>

        <div class="usage-content">
          <div class="code-showcase">
            <div class="code-tabs">
              <button
                v-for="(tab, i) in codeTabs"
                :key="i"
                class="code-tab"
                :class="{ active: activeCodeTab === i }"
                @click="activeCodeTab = i"
              >
                {{ tab.name }}
              </button>
            </div>

            <div class="v-code-block">
              <div class="v-code-block__header">
                <span>{{ codeTabs[activeCodeTab].filename }}</span>
              </div>
              <div class="v-code-block__body">
                <div
                  v-for="(line, i) in codeTabs[activeCodeTab].lines"
                  :key="i"
                  class="code-line"
                  :class="{ highlight: line.highlight }"
                  :style="{ animationDelay: `${i * 0.05}s` }"
                >
                  <span class="line-number">{{ i + 1 }}</span>
                  <span class="line-content" v-html="highlightCode(line.content)"></span>
                </div>
              </div>
            </div>
          </div>

          <div class="usage-features">
            <div
              v-for="(feat, i) in usageFeatures"
              :key="i"
              class="usage-feature"
              :data-animate="`fade-in-up`"
              :style="{ animationDelay: `${i * 0.1}s` }"
            >
              <span class="feature-icon">{{ feat.icon }}</span>
              <span class="feature-text">{{ feat.text }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 第 6 屏：适用场景 ===== -->
      <section class="section scenarios" id="scenarios">
        <h2 class="v-title-section">{{ $t('home.scenarios.title') }}</h2>

        <div class="scenarios-grid">
          <div
            v-for="(scenario, i) in scenarios"
            :key="i"
            class="scenario-card"
            :data-animate="`scale-in`"
            :style="{ animationDelay: `${i * 0.1}s` }"
          >
            <div class="scenario-icon">{{ scenario.icon }}</div>
            <h3 class="scenario-title">{{ scenario.title }}</h3>
            <p class="scenario-desc">{{ scenario.desc }}</p>
          </div>
        </div>
      </section>

      <!-- ===== 第 7 屏：生态与行动 ===== -->
      <section class="section ecosystem" id="ecosystem">
        <div class="ecosystem-content">
          <h2 class="v-title-section">{{ $t('home.eco.title') }}</h2>

          <p class="ecosystem-desc">{{ $t('home.eco.desc') }}</p>

          <div class="ecosystem-actions">
            <a class="v-btn v-btn--primary" :href="$t('home.eco.githubUrl')" target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              {{ $t('home.eco.github') }}
            </a>
            <a class="v-btn" :href="docsUrl">
              📖 {{ $t('home.eco.docs') }}
            </a>
            <button class="v-btn v-btn--ghost" @click="$router.push('/examples')">
              🎨 {{ $t('home.eco.examples') }}
            </button>
          </div>

          <div class="ecosystem-links">
            <a href="https://www.npmjs.com/package/@variojs/vue" target="_blank" class="eco-link">
              <span class="eco-link-icon">📦</span>
              <span class="eco-link-text">npm</span>
            </a>
            <a href="#" class="eco-link">
              <span class="eco-link-icon">💬</span>
              <span class="eco-link-text">Discord</span>
            </a>
            <a href="#" class="eco-link">
              <span class="eco-link-icon">🐦</span>
              <span class="eco-link-text">Twitter</span>
            </a>
          </div>

          <div class="ecosystem-footer">
            <p>MIT License · Vario Team</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import ParticleBackground from '@src/components/ParticleBackground.vue'

gsap.registerPlugin(ScrollTrigger)

const { t } = useI18n()

// ===== 文档链接：开发环境使用 localhost，生产环境使用相对路径 =====
const getDocsUrl = () => {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_DOCS_URL || 'http://localhost:5174/docs/'
  } else {
    const base = import.meta.env.BASE_URL || '/'
    return base + 'docs/'
  }
}

const docsUrl = computed(() => getDocsUrl())

// ===== 数据定义 =====

// Hero 标题字符
const titleChars = computed(() => 'VARIO'.split(''))

// 痛点
const painPoints = computed(() => [
  t('home.why.pain1'),
  t('home.why.pain2'),
  t('home.why.pain3')
])

// 解法
const solutions = computed(() => [
  t('home.why.vario1'),
  t('home.why.vario2'),
  t('home.why.vario3')
])

// 核心能力（6个偶数对称）
const skills = computed(() => [
  { icon: '📐', title: t('home.skills.schema.title'), desc: t('home.skills.schema.desc') },
  { icon: '⚡', title: t('home.skills.vm.title'), desc: t('home.skills.vm.desc') },
  { icon: '🔧', title: t('home.skills.runtime.title'), desc: t('home.skills.runtime.desc') },
  { icon: '🚀', title: t('home.skills.memo.title'), desc: t('home.skills.memo.desc') },
  { icon: '🛡️', title: t('home.skills.sandbox.title'), desc: t('home.skills.sandbox.desc') },
  { icon: '🔍', title: t('home.skills.expression.title'), desc: t('home.skills.expression.desc') }
])

// 架构层级
const archLayers = computed(() => [
  {
    name: 'Renderer',
    abbr: 'R',
    title: t('home.arch.renderer.title'),
    desc: t('home.arch.renderer.desc'),
    color: '#10b981',
    features: t('home.arch.renderer.features').split(',')
  },
  {
    name: 'Schema',
    abbr: 'S',
    title: t('home.arch.schema.title'),
    desc: t('home.arch.schema.desc'),
    color: '#38bdf8',
    features: t('home.arch.schema.features').split(',')
  },
  {
    name: 'Core',
    abbr: 'C',
    title: t('home.arch.core.title'),
    desc: t('home.arch.core.desc'),
    color: '#2563eb',
    features: t('home.arch.core.features').split(',')
  }
])

// 代码标签页 - 使用真实 Vario Schema 格式（支持国际化）
const codeTabs = computed(() => [
  {
    name: 'Schema',
    filename: 'schema.ts',
    lines: [
      { content: "import { defineSchema } from '@variojs/schema'", highlight: false },
      { content: '', highlight: false },
      { content: 'export default defineSchema({', highlight: true },
      { content: "  type: 'form',", highlight: false },
      { content: '  state: {', highlight: false },
      { content: "    username: '',", highlight: false },
      { content: "    email: ''", highlight: false },
      { content: '  },', highlight: false },
      { content: '', highlight: false },
      { content: '  schema: (ctx) => ({', highlight: false },
      { content: "    type: 'div',", highlight: false },
      { content: '    children: [', highlight: false },
      { content: '      {', highlight: false },
      { content: "        type: 'input',", highlight: false },
      { content: "        bind: 'username',", highlight: true },
      { content: `        placeholder: '${t('home.codeExamples.placeholder')}'`, highlight: false },
      { content: '      },', highlight: false },
      { content: '      {', highlight: false },
      { content: "        type: 'button',", highlight: false },
      { content: `        text: '${t('home.codeExamples.submit')}',`, highlight: false },
      { content: '        events: {', highlight: false },
      { content: "          click: { type: 'call', method: 'submit' }", highlight: true },
      { content: '        }', highlight: false },
      { content: '      }', highlight: false },
      { content: '    ]', highlight: false },
      { content: '  })', highlight: false },
      { content: '})', highlight: true }
    ]
  },
  {
    name: 'Vue',
    filename: 'App.vue',
    lines: [
      { content: '<template>', highlight: false },
      { content: '  <component :is="vnode" />', highlight: true },
      { content: '</template>', highlight: false },
      { content: '', highlight: false },
      { content: '<script setup lang="ts">', highlight: false },
      { content: "import { useVario } from '@variojs/vue'", highlight: false },
      { content: "import schema from './schema'", highlight: false },
      { content: '', highlight: false },
      { content: 'const { vnode, state } = useVario(schema, {', highlight: true },
      { content: '  state: { count: 0 },', highlight: false },
      { content: '  methods: {', highlight: false },
      { content: '    increment: ({ state }) => {', highlight: false },
      { content: '      state.count++', highlight: false },
      { content: '    }', highlight: false },
      { content: '  }', highlight: false },
      { content: '})', highlight: false },
      { content: '</' + 'script>', highlight: false }
    ]
  },
  {
    name: 'JSON',
    filename: 'schema.json',
    lines: [
      { content: '{', highlight: false },
      { content: '  "type": "div",', highlight: false },
      { content: '  "props": {', highlight: false },
      { content: '    "class": "counter-demo"', highlight: false },
      { content: '  },', highlight: false },
      { content: '  "children": [', highlight: false },
      { content: '    {', highlight: false },
      { content: '      "type": "h2",', highlight: false },
      { content: `      "children": "${t('home.codeExamples.counterTitle')}"`, highlight: false },
      { content: '    },', highlight: false },
      { content: '    {', highlight: false },
      { content: '      "type": "div",', highlight: false },
      { content: '      "children": "{{ count }}"', highlight: true },
      { content: '    },', highlight: false },
      { content: '    {', highlight: false },
      { content: '      "type": "button",', highlight: false },
      { content: '      "children": "+1",', highlight: false },
      { content: '      "events": {', highlight: false },
      { content: '        "click": {', highlight: false },
      { content: '          "type": "call",', highlight: true },
      { content: '          "method": "increment"', highlight: false },
      { content: '        }', highlight: false },
      { content: '      }', highlight: false },
      { content: '    }', highlight: false },
      { content: '  ]', highlight: false },
      { content: '}', highlight: false }
    ]
  }
])

const activeCodeTab = ref(0)

// 使用特性
const usageFeatures = computed(() => [
  { icon: '📝', text: t('home.usage.feature1') },
  { icon: '🔗', text: t('home.usage.feature2') },
  { icon: '🎯', text: t('home.usage.feature3') }
])

// 适用场景
const scenarios = computed(() => [
  { icon: '🏗️', title: t('home.scenarios.lowcode'), desc: t('home.scenarios.lowcodeDesc') },
  { icon: '🎨', title: t('home.scenarios.editor'), desc: t('home.scenarios.editorDesc') },
  { icon: '📋', title: t('home.scenarios.form'), desc: t('home.scenarios.formDesc') },
  { icon: '🤖', title: t('home.scenarios.ai'), desc: t('home.scenarios.aiDesc') }
])

// 架构高亮状态
const activeArchStep = ref(2) // 默认高亮 Core

// ===== 代码高亮 - 先转义HTML再高亮 =====
const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const highlightCode = (code: string) => {
  // 1. 先转义HTML特殊字符
  let escaped = escapeHtml(code)
  
  // 2. 语法高亮（不包括分号，避免破坏HTML实体末尾的;）
  return escaped
    .replace(/(['"`])(.*?)(\1)/g, '<span class="v-token--string">$1$2$1</span>')
    .replace(/\b(import|from|const|let|var|export|default|type|return|if|else|function)\b/g, '<span class="v-token--key">$1</span>')
    .replace(/\b(true|false|null|undefined)\b/g, '<span class="v-token--boolean">$1</span>')
    .replace(/\b\d+\b/g, '<span class="v-token--number">$&</span>')
    .replace(/({|}|\[|\]|\(|\)|:|,)/g, '<span class="v-token--punct">$1</span>')
}

// ===== ScrollTrigger 动画 =====
let triggers: ScrollTrigger[] = []

onMounted(() => {
  // 等待 DOM 完全渲染
  nextTick(() => {
    initAnimations()
  })
})

// 监听 tab 切换，重新初始化代码动画
watch(activeCodeTab, () => {
  nextTick(() => {
    initCodeLineAnimations()
  })
})

const initCodeLineAnimations = () => {
  // 代码行逐行淡入
  const codeLines = document.querySelectorAll('.code-line')
  codeLines.forEach((line, index) => {
    const el = line as HTMLElement
    el.style.opacity = '0'
    el.style.transform = 'translateX(-20px)'
    
    // 使用 GSAP 动画，带延迟
    gsap.to(el, {
      opacity: 1,
      x: 0,
      duration: 0.4,
      delay: index * 0.05,
      ease: 'power2.out'
    })
  })
}

const initAnimations = () => {
  // 入场动画
  const animatedElements = document.querySelectorAll('[data-animate]')
  if (!animatedElements.length) return
  
  animatedElements.forEach((el) => {
    const animation = el.getAttribute('data-animate')
    const delay = parseFloat((el as HTMLElement).style.animationDelay || '0')

    let fromVars: gsap.TweenVars = { opacity: 0 }
    let toVars: gsap.TweenVars = { opacity: 1, duration: 0.6, delay }

    switch (animation) {
      case 'fade-in-up':
        fromVars = { opacity: 0, y: 30 }
        toVars = { opacity: 1, y: 0, duration: 0.6, delay, ease: 'power2.out' }
        break
      case 'scale-in':
        fromVars = { opacity: 0, scale: 0.9 }
        toVars = { opacity: 1, scale: 1, duration: 0.6, delay, ease: 'back.out(1.7)' }
        break
      case 'slide-left':
        fromVars = { opacity: 0, x: -60 }
        toVars = { opacity: 1, x: 0, duration: 0.6, delay, ease: 'power2.out' }
        break
      case 'slide-right':
        fromVars = { opacity: 0, x: 60 }
        toVars = { opacity: 1, x: 0, duration: 0.6, delay, ease: 'power2.out' }
        break
    }

    gsap.fromTo(el, fromVars, {
      ...toVars,
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        toggleActions: 'play none none reverse'
      }
    })
  })

  initCodeLineAnimations()

  // 视差效果
  const parallaxElements = document.querySelectorAll('[data-parallax]')
  parallaxElements.forEach((el) => {
    const speed = parseFloat(el.getAttribute('data-parallax') || '1')
    const tween = gsap.to(el, {
      y: () => -100 * (speed - 0.5),
      ease: 'none',
      scrollTrigger: {
        trigger: '.home-container',
        start: 'top top',
        end: 'bottom bottom',
        scrub: true
      }
    })
    if (tween.scrollTrigger) triggers.push(tween.scrollTrigger)
  })

  // 架构滚动联动
  const archSteps = document.querySelectorAll('.arch-step')
  archSteps.forEach((step, index) => {
    const trigger = ScrollTrigger.create({
      trigger: step,
      start: 'top 60%',
      end: 'bottom 40%',
      onEnter: () => { activeArchStep.value = index },
      onEnterBack: () => { activeArchStep.value = index }
    })
    triggers.push(trigger)
  })
}

onBeforeUnmount(() => {
  triggers.forEach(t => t.kill())
  triggers = []
})
</script>

<style lang="scss">
@use '@src/styles/home.scss' as *;

// ============================================
// Home Container
// ============================================
.home-container {
  position: relative;
  color: var(--v-text-secondary);
  background: radial-gradient(ellipse 1200px 800px at 50% 0%, var(--v-bg-tertiary) 0%, var(--v-bg-secondary) 50%, var(--v-bg-primary) 100%);
  min-height: 100vh;
}

// Light theme home container adjustment
:root:not(.dark) {
  .home-container {
    background: radial-gradient(ellipse 1200px 600px at 50% 0%, rgba(59, 130, 246, 0.08) 0%, var(--v-bg-tertiary) 30%, var(--v-bg-secondary) 60%, var(--v-bg-primary) 100%);
  }
}

.parallax-decor {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;

  .decor-glow-1 {
    position: absolute;
    top: 20%;
    right: 10%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, transparent 70%);
    filter: blur(60px);
  }

  .decor-glow-2 {
    position: absolute;
    bottom: 30%;
    left: 5%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%);
    filter: blur(50px);
  }
}

// Light theme adjustments for decor glows
:root:not(.dark) {
  .parallax-decor {
    .decor-glow-1 {
      background: radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
      opacity: 0.6;
    }

    .decor-glow-2 {
      background: radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%);
      opacity: 0.5;
    }
  }
}

.content-layer {
  position: relative;
  z-index: 10;
}

// ============================================
// Hero Section
// ============================================
.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  padding: var(--v-space-4xl) var(--v-space-xl);
}

.hero-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--v-space-lg);
  max-width: 900px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--v-space-sm);
  padding: var(--v-space-sm) var(--v-space-md);
  background: rgba(37, 99, 235, 0.1);
  border: 1px solid rgba(37, 99, 235, 0.3);
  border-radius: var(--v-radius-full);
  font-size: 0.85rem;
  color: var(--v-primary-300);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.badge-dot {
  width: 8px;
  height: 8px;
  background: var(--v-primary-500);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.hero-title {
  @extend .v-title-hero;
  display: flex;
  justify-content: center;
  gap: 0.05em;

  .title-char {
    display: inline-block;
    animation: fadeInScale 0.5s ease forwards;
    opacity: 0;
    transform: scale(0.8);

    &:hover {
      color: var(--v-primary-400);
      transform: translateY(-5px);
      transition: all 0.3s ease;
    }
  }
}

.hero-subtitle {
  font-size: clamp(1rem, 2vw, 1.5rem);
  color: var(--v-primary-300);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin: 0;
}

.hero-desc {
  font-size: 1.1rem;
  color: var(--v-text-tertiary);
  max-width: 600px;
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--v-space-md);
  justify-content: center;
  margin-top: var(--v-space-md);

  .btn-icon {
    display: inline-flex;
    margin-right: 8px;
  }
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: var(--v-space-xl);
  margin-top: var(--v-space-2xl);
  padding-top: var(--v-space-xl);
  border-top: 1px solid var(--v-border-default);

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--v-primary-600);
  }

  // Light theme adjustment
  :root:not(.dark) & .stat-value {
    color: var(--v-primary-700);
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--v-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .stat-divider {
    width: 1px;
    height: 40px;
    background: var(--v-border-default);
  }
}

// Scroll Indicator
.scroll-indicator {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  color: var(--v-text-tertiary);

  .scroll-arrow {
    animation: float-down 1.5s ease-in-out infinite;
  }
}

@keyframes float-down {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.7;
  }
  50% {
    transform: translateY(10px);
    opacity: 1;
  }
}

// ============================================
// Why Section
// ============================================
.why {
  @extend .v-section;
}

.why-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: var(--v-space-2xl);
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: var(--v-space-xl);
  }
}

.why-panel {
  @extend .v-glass;
  padding: var(--v-space-2xl);
  border-radius: var(--v-radius-xl);

  &--problem {
    border-left: 3px solid var(--v-accent-red);
  }

  &--solution {
    border-left: 3px solid var(--v-primary-500);
  }
}

.panel-header {
  display: flex;
  align-items: center;
  gap: var(--v-space-md);
  margin-bottom: var(--v-space-lg);

  .panel-icon {
    font-size: 1.5rem;
  }

  .panel-label {
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--v-text-tertiary);
  }
}

.problem-list,
.solution-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--v-space-md);
}

.problem-item,
.solution-item {
  display: flex;
  align-items: flex-start;
  gap: var(--v-space-md);
  padding: var(--v-space-md);
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--v-radius-md);

  // Light theme adjustment
  :root:not(.dark) & {
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.08);
  }
}

.item-x {
  color: var(--v-accent-red);
  font-weight: 700;
}

.item-check {
  color: var(--v-primary-500);
  font-weight: 700;
}

.why-divider {
  display: flex;
  justify-content: center;
  align-items: center;

  @media (max-width: 900px) {
    transform: rotate(90deg);
  }

  .divider-arrow {
    width: 60px;
    height: 60px;
    background: var(--v-primary-600);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    animation: glowPulse 2s ease-in-out infinite;

    svg {
      width: 30px;
      height: 30px;
    }
  }
}

// ============================================
// Skills Section
// ============================================
.skills {
  @extend .v-section;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--v-space-lg);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.skill-card {
  @extend .v-glass-hover;
  padding: var(--v-space-xl);
  border-radius: var(--v-radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--v-space-md);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-5px);
  }

  // 6卡片对称布局: 2行 x 3列
  &--0 { grid-column: 1; grid-row: 1; }
  &--1 { grid-column: 2; grid-row: 1; }
  &--2 { grid-column: 3; grid-row: 1; }
  &--3 { grid-column: 1; grid-row: 2; }
  &--4 { grid-column: 2; grid-row: 2; }
  &--5 { grid-column: 3; grid-row: 2; }

  @media (max-width: 1024px) {
    &--0, &--1, &--2, &--3, &--4, &--5 {
      grid-column: auto;
      grid-row: auto;
    }
  }
}

.skill-icon-wrapper {
  display: flex;
  align-items: center;
  gap: var(--v-space-md);
}

.skill-number {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--v-primary-500);
  letter-spacing: 0.2em;
}

.skill-icon {
  font-size: 1.5rem;
}

.skill-title {
  @extend .v-title-card;
  margin: 0;
}

.skill-desc {
  color: var(--v-text-tertiary);
  line-height: 1.6;
  margin: 0;
}

// ============================================
// Architecture Section
// ============================================
.architecture {
  @extend .v-section;
}

.arch-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--v-space-3xl);
  align-items: start;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.arch-content {
  display: grid;
  gap: var(--v-space-lg);
}

.arch-step {
  @extend .v-glass;
  padding: var(--v-space-xl);
  border-radius: var(--v-radius-lg);
  border-left: 3px solid transparent;
  transition: all 0.3s ease;
  cursor: pointer;

  &.active {
    border-left-color: var(--v-primary-500);
    background: var(--v-bg-card-hover);
  }

  &:hover {
    transform: translateX(5px);
  }
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  color: white;
  margin-bottom: var(--v-space-md);
}

.step-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--v-text-primary);
  margin: 0 0 var(--v-space-sm) 0;
}

.step-desc {
  color: var(--v-text-tertiary);
  margin-bottom: var(--v-space-md);
}

.step-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--v-space-sm);

  li {
    padding: var(--v-space-xs) var(--v-space-sm);
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--v-radius-sm);
    font-size: 0.85rem;
    color: var(--v-text-secondary);
  }
}

.arch-visual {
  position: sticky;
  top: 20vh;

  @media (max-width: 900px) {
    position: relative;
    top: 0;
  }
}

.arch-diagram {
  @extend .v-glass;
  padding: var(--v-space-2xl);
  border-radius: var(--v-radius-xl);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--v-space-lg);
}

.arch-layer {
  display: flex;
  align-items: center;
  gap: var(--v-space-md);
  padding: var(--v-space-lg);
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--v-radius-md);
  border: 1px solid var(--v-border-default);
  transition: all 0.3s ease;
  cursor: pointer;

  &.active {
    border-color: var(--layer-color);
    background: rgba(37, 99, 235, 0.1);
    box-shadow: 0 0 20px rgba(37, 99, 235, 0.2);
  }

  &:hover {
    transform: translateX(5px);
  }
}

.layer-indicator {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.layer-content {
  display: flex;
  align-items: center;
  gap: var(--v-space-md);
  flex: 1;
}

.layer-name {
  font-weight: 600;
  color: var(--v-text-primary);
}

.layer-abbr {
  margin-left: auto;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--v-text-tertiary);
}

.arch-connections {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 80%;
  pointer-events: none;
  opacity: 0.5;
}

// ============================================
// Usage Section
// ============================================
.usage {
  @extend .v-section;
}

.usage-content {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.code-showcase {
  margin-bottom: var(--v-space-3xl);
}

.code-tabs {
  display: flex;
  gap: var(--v-space-sm);
  margin-bottom: var(--v-space-md);
}

.code-tab {
  padding: var(--v-space-sm) var(--v-space-lg);
  background: transparent;
  border: 1px solid var(--v-border-default);
  border-radius: var(--v-radius-md);
  color: var(--v-text-tertiary);
  cursor: pointer;
  transition: all 0.3s ease;

  &.active,
  &:hover {
    background: rgba(37, 99, 235, 0.1);
    border-color: var(--v-primary-500);
    color: var(--v-text-primary);
  }
}

.code-line {
  display: flex;
  gap: var(--v-space-md);
  padding: 2px 0;
  font-family: var(--v-font-mono);
  font-size: 0.9rem;
  opacity: 0;

  &.highlight {
    background: rgba(37, 99, 235, 0.1);
    border-radius: 4px;
  }
}

.line-number {
  color: var(--v-text-muted);
  min-width: 30px;
  text-align: right;
  user-select: none;
}

.line-content {
  color: var(--v-text-secondary);
  white-space: pre;
  font-family: var(--v-font-mono);
  line-height: 1.6;
}

.usage-features {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--v-space-lg);
}

.usage-feature {
  display: flex;
  align-items: center;
  gap: var(--v-space-sm);
  padding: var(--v-space-md) var(--v-space-lg);
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--v-radius-full);
  border: 1px solid var(--v-border-default);

  .feature-icon {
    font-size: 1.2rem;
  }

  .feature-text {
    color: var(--v-text-secondary);
  }
}

// ============================================
// Scenarios Section
// ============================================
.scenarios {
  @extend .v-section;
}

.scenarios-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--v-space-lg);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.scenario-card {
  @extend .v-glass-hover;
  padding: var(--v-space-2xl);
  border-radius: var(--v-radius-xl);
  text-align: center;
  transition: all 0.3s ease;

  &:hover {
    transform: scale(1.05);
    box-shadow: var(--v-shadow-glow);
  }
}

.scenario-icon {
  font-size: 3rem;
  margin-bottom: var(--v-space-md);
}

.scenario-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--v-text-primary);
  margin: 0 0 var(--v-space-sm) 0;
}

.scenario-desc {
  color: var(--v-text-tertiary);
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0;
}

// ============================================
// Ecosystem Section
// ============================================
.ecosystem {
  @extend .v-section;
  background: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.5) 100%);
}

.ecosystem-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--v-space-xl);
  max-width: 800px;
  margin: 0 auto;
}

.ecosystem-desc {
  font-size: 1.1rem;
  color: var(--v-text-tertiary);
  max-width: 600px;
}

.ecosystem-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--v-space-md);
}

.ecosystem-links {
  display: flex;
  gap: var(--v-space-lg);
  margin-top: var(--v-space-xl);
}

.eco-link {
  display: flex;
  align-items: center;
  gap: var(--v-space-sm);
  color: var(--v-text-tertiary);
  text-decoration: none;
  transition: all 0.3s ease;

  &:hover {
    color: var(--v-primary-400);
  }
}

.eco-link-icon {
  font-size: 1.2rem;
}

.eco-link-text {
  font-size: 0.9rem;
}

.ecosystem-footer {
  margin-top: var(--v-space-3xl);
  padding-top: var(--v-space-xl);
  border-top: 1px solid var(--v-border-default);

  p {
    color: var(--v-text-muted);
    font-size: 0.9rem;
  }
}

// ============================================
// Animation Keyframes
// ============================================
@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>