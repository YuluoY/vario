<template>
  <div class="playground" :class="{ 'playground--fullscreen': isFullscreen }">
    <!-- 工具栏 -->
    <div class="playground__toolbar">
      <div class="playground__toolbar-left">
        <el-button-group>
          <el-button :icon="VideoPlay" @click="runCode" :loading="isRunning" type="primary">
            {{ $t('playground.run') }}
          </el-button>
          <el-button :icon="Refresh" @click="resetCode">{{ $t('playground.reset') }}</el-button>
          <el-button @click="formatCode">{{ $t('playground.format') }}</el-button>
        </el-button-group>
        <el-switch
          v-model="autoRun"
          :active-text="$t('playground.autoRun')"
          style="margin-left: 16px;"
        />
      </div>
      <div class="playground__toolbar-right">
        <el-button-group>
          <el-button :icon="isFullscreen ? FullScreen : Aim" @click="toggleFullscreen">
            {{ isFullscreen ? $t('playground.exitFullscreen') : $t('playground.fullscreen') }}
          </el-button>
        </el-button-group>
        <el-tag :type="statusType" class="playground__status">
          {{ statusText }}
        </el-tag>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="playground__content">
      <!-- 代码编辑器 -->
      <div class="playground__editor" :class="{ 'playground__editor--hidden': isFullscreen && !showEditor }">
        <div class="playground__editor-header">
          <span class="playground__editor-title">{{ $t('playground.codeEditor') }}</span>
          <el-button
            v-if="isFullscreen"
            :icon="showEditor ? Hide : View"
            text
            size="small"
            @click="showEditor = !showEditor"
          >
            {{ showEditor ? $t('playground.hide') : $t('playground.show') }}
          </el-button>
        </div>
        <div class="playground__editor-wrapper">
          <MonacoEditor
            ref="monacoEditorRef"
            :key="editorTheme"
            :value="code"
            language="typescript"
            :theme="editorTheme"
            :options="editorOptions"
            class="playground__monaco"
            @update:value="onCodeChange"
            @editorDidMount="handleEditorMount"
          />
        </div>
      </div>

      <!-- 预览区域 -->
      <div class="playground__preview" :class="{ 'playground__preview--full': isFullscreen && !showEditor }">
        <div class="playground__preview-header">
          <span class="playground__preview-title">{{ $t('playground.preview') }}</span>
          <el-button-group size="small">
            <el-button :icon="Refresh" @click="runCode" text>{{ $t('playground.refresh') }}</el-button>
            <el-button :icon="Document" @click="showState = !showState" text>
              {{ showState ? $t('playground.hideState') : $t('playground.showState') }}
            </el-button>
          </el-button-group>
        </div>
        <div class="playground__preview-content">
          <div v-if="error" class="playground__error">
            <el-alert
              :title="$t('playground.error')"
              type="error"
              :description="error"
              show-icon
              :closable="false"
            />
          </div>
          <div v-else-if="!component" class="playground__empty">
            <el-empty description="编写 Schema 和方法来测试 Vario">
              <template #extra>
                <div class="playground__shortcuts">
                  <p><kbd>Ctrl/Cmd + S</kbd> 或 <kbd>Ctrl/Cmd + Enter</kbd> 运行代码</p>
                  <p><kbd>Ctrl/Cmd + Shift + F</kbd> 格式化代码</p>
                  <p style="margin-top: 12px; color: var(--text-secondary);">
                    💡 提示：定义 schema、initialState 和 methods，点击运行查看效果
                  </p>
                </div>
              </template>
            </el-empty>
          </div>
          <div v-else class="playground__render">
            <component v-if="component" :is="component" />
          </div>
        </div>
        <!-- 运行时状态面板 -->
        <el-collapse-transition>
          <div v-if="showState && runtimeState" class="playground__state">
            <div class="playground__state-header">
              <span>{{ $t('playground.runtimeState') }}</span>
            </div>
            <div class="playground__state-content">
              <pre>{{ JSON.stringify(runtimeState, null, 2) }}</pre>
            </div>
          </div>
        </el-collapse-transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, getCurrentInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { VideoPlay, Refresh, Document, FullScreen, Aim, View, Hide } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import MonacoEditor from 'monaco-editor-vue3'
import * as monaco from 'monaco-editor'
import { useVario } from '@variojs/vue'


const { t } = useI18n()
const instance = getCurrentInstance()

// 检测主题
const isDark = ref(checkIsDark())

function checkIsDark(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark' || 
         document.documentElement.classList.contains('dark')
}

const editorTheme = computed(() => isDark.value ? 'vs-dark' : 'vs')

// 监听主题变化
function observeThemeChange() {
  // 使用 MutationObserver 监听 data-theme 属性变化
  const observer = new MutationObserver(() => {
    isDark.value = checkIsDark()
  })
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class']
  })
  
  return observer
}

// 编辑器配置
const editorOptions = {
  minimap: { enabled: true },
  fontSize: 14,
  lineNumbers: 'on' as const,
  roundedSelection: false,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: 'on' as const,
  formatOnPaste: true,
  formatOnType: true,
  readOnly: false,
  cursorStyle: 'line' as const,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
  suggestOnTriggerCharacters: true,
  quickSuggestions: {
    other: true,
    comments: false,
    strings: false
  },
  parameterHints: {
    enabled: true
  },
  acceptSuggestionOnEnter: 'on' as const,
  bracketPairColorization: {
    enabled: true
  },
  guides: {
    bracketPairs: true,
    indentation: true
  },
  folding: true,
  foldingStrategy: 'indentation' as const,
  showFoldingControls: 'always' as const,
  matchBrackets: 'always' as const,
  snippetSuggestions: 'inline' as const
}

// 默认代码模板
function getDefaultCode(): string {
  return `// 定义 Schema
const schema = {
  type: 'div',
  props: {
    style: 'padding: 24px; max-width: 600px; margin: 0 auto;'
  },
  children: [
    {
      type: 'h2',
      props: { style: 'margin-bottom: 20px;' },
      children: 'Hello Vario!'
    },
    {
      type: 'ElCard',
      props: {
        shadow: 'hover',
        style: 'margin-bottom: 20px;'
      },
      children: [
        {
          type: 'div',
          props: { style: 'font-size: 18px; margin-bottom: 16px;' },
          children: '计数器: {{ count }}'
        },
        {
          type: 'ElSpace',
          props: { direction: 'horizontal', size: 'large' },
          children: [
            {
              type: 'ElButton',
              props: { type: 'primary', icon: 'Plus' },
              events: {
                click: [{ type: 'call', method: 'increment' }]
              },
              children: '增加'
            },
            {
              type: 'ElButton',
              props: { type: 'danger', icon: 'Minus' },
              events: {
                click: [{ type: 'call', method: 'decrement' }]
              },
              children: '减少'
            }
          ]
        }
      ]
    }
  ]
}

// 定义初始状态
const initialState = {
  count: 0
}

// 定义方法
const methods = {
  increment: ({ state }) => {
    state.count++
  },
  decrement: ({ state }) => {
    state.count--
  }
}`
}

// 状态
const code = ref(getDefaultCode())
const isRunning = ref(false)
const error = ref<string | null>(null)
const isFullscreen = ref(false)
const showEditor = ref(true)
const showState = ref(true)
const vnodeRef = ref<any>(null) // 存储 useVario 返回的 vnode Ref
const runtimeState = ref<any>(null)
const monacoEditorRef = ref<any>(null)
const editorInstance = ref<any>(null)
const autoRun = ref(false)

// 计算属性：将 vnodeRef（可能是 Ref<VNode>）转换为渲染用的组件
// vnodeRef.value 本身是一个 Ref，所以需要解包两层
const component = computed(() => {
  if (!vnodeRef.value) return null
  // vnodeRef.value 是 useVario 返回的 vnode Ref，它的 .value 才是实际的 VNode
  return vnodeRef.value.value ?? vnodeRef.value
})

// 防抖定时器
let autoRunTimer: ReturnType<typeof setTimeout> | null = null

// 状态类型和文本
const statusType = computed(() => {
  if (error.value) return 'danger'
  if (isRunning.value) return 'warning'
  return 'success'
})

const statusText = computed(() => {
  if (error.value) return t('playground.hasError')
  if (isRunning.value) return t('playground.running')
  return t('playground.ready')
})

// 代码变化处理
function onCodeChange(value: string) {
  code.value = value
  
  // 自动运行
  if (autoRun.value) {
    if (autoRunTimer) {
      clearTimeout(autoRunTimer)
    }
    autoRunTimer = setTimeout(() => {
      runCode()
    }, 1000) // 1秒防抖
  }
}

// 运行代码
async function runCode() {
  isRunning.value = true
  error.value = null
  vnodeRef.value = null
  runtimeState.value = null

  try {
    // 解析代码获取 schema, state, methods
    const parsed = parseCode(code.value)
    if (!parsed) {
      throw new Error('无法解析代码')
    }

    const { schema, state, methods: userMethods } = parsed

    // 使用 useVario 渲染
    const result = useVario(schema, {
      app: instance?.appContext.app || null,
      state: state || {},
      methods: userMethods || {},
      onError: (err) => {
        error.value = err.message
        console.error('[Playground] Error:', err)
      }
    })

    // 保存 vnode ref（用于渲染）
    vnodeRef.value = result.vnode

    // 监听状态变化
    watch(
      () => result.state,
      (newState) => {
        try {
          runtimeState.value = JSON.parse(JSON.stringify(newState))
        } catch (e) {
          // 忽略循环引用等错误
        }
      },
      { deep: true, immediate: true }
    )

    if (!autoRun.value) {
      ElMessage.success(t('playground.runSuccess'))
    }
  } catch (err: any) {
    error.value = err.message || t('playground.parseError')
    console.error('[Playground] Parse error:', err)
    if (!autoRun.value) {
      ElMessage.error(err.message || t('playground.parseError'))
    }
  } finally {
    isRunning.value = false
  }
}

// 解析代码
function parseCode(codeStr: string): { schema: any; state?: any; methods?: any } | null {
  try {
    // 处理代码：移除类型注解和 import/export
    let processedCode = codeStr
      // 移除 import 语句
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
      // 移除 export 关键字
      .replace(/^(\s*)export\s+const\s+/gm, '$1const ')
      .replace(/^(\s*)export\s+default\s+/gm, '$1')
      // 移除类型注解
      .replace(/:\s*Schema\b/g, '')
      .replace(/:\s*any\b/g, '')
      // 清理多余的空行
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    // 创建执行环境
    const result: any = {}
    
    // 使用 Function 构造器执行代码
    const executor = new Function('result', `
      ${processedCode}
      
      // 收集变量
      if (typeof schema !== 'undefined') result.schema = schema
      if (typeof initialState !== 'undefined') result.state = initialState
      if (typeof state !== 'undefined' && !result.state) result.state = state
      if (typeof methods !== 'undefined') result.methods = methods
      
      return result
    `)
    
    const parsed = executor(result)
    
    if (!parsed || !parsed.schema) {
      throw new Error(t('playground.noSchemaFound'))
    }

    return {
      schema: parsed.schema,
      state: parsed.state || {},
      methods: parsed.methods || {}
    }
  } catch (err: any) {
    console.error('[Playground] Parse error:', err)
    throw new Error(`${t('playground.codeParseFailed')}: ${err.message}`)
  }
}

// 重置代码
function resetCode() {
  const defaultCode = getDefaultCode()
  code.value = defaultCode
  error.value = null
  vnodeRef.value = null
  runtimeState.value = null

  // monaco-editor-vue3 不响应外部 value 变更，需手动同步编辑器显示
  const editor = getEditorInstance()
  if (editor && typeof editor.setValue === 'function' && editor.getValue() !== defaultCode) {
    editor.setValue(defaultCode)
  }

  ElMessage.success(t('playground.codeReset'))
}

// 格式化代码
function formatCode() {
  const editor = getEditorInstance()
  if (!editor) {
    ElMessage.warning('编辑器未就绪')
    return
  }
  
  try {
    editor.getAction('editor.action.formatDocument')?.run()
    ElMessage.success('代码已格式化')
  } catch (err) {
    console.error('[Playground] Format error:', err)
    ElMessage.error('格式化失败')
  }
}

// 全屏功能
function toggleFullscreen() {
  if (!isFullscreen.value) {
    enterFullscreen()
  } else {
    exitFullscreen()
  }
}

function enterFullscreen() {
  const elem = document.documentElement
  if (elem.requestFullscreen) {
    elem.requestFullscreen()
  } else if ((elem as any).webkitRequestFullscreen) {
    ;(elem as any).webkitRequestFullscreen()
  } else if ((elem as any).msRequestFullscreen) {
    ;(elem as any).msRequestFullscreen()
  }
  isFullscreen.value = true
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen()
  } else if ((document as any).webkitExitFullscreen) {
    ;(document as any).webkitExitFullscreen()
  } else if ((document as any).msExitFullscreen) {
    ;(document as any).msExitFullscreen()
  }
  isFullscreen.value = false
}

// 监听全屏状态变化
function handleFullscreenChange() {
  isFullscreen.value = !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).msFullscreenElement
  )
}

let themeObserver: MutationObserver | null = null

// 编辑器挂载事件处理
function handleEditorMount(editor: any) {
  editorInstance.value = editor
  setTimeout(() => {
    setupMonacoShortcuts()
  }, 100)
}

// 获取编辑器实例的辅助函数
function getEditorInstance() {
  // 优先使用通过事件保存的实例
  if (editorInstance.value) {
    return editorInstance.value
  }
  
  if (!monacoEditorRef.value) {
    return null
  }
  
  // 尝试多种方式获取编辑器实例
  const refValue = monacoEditorRef.value as any
  
  // 方法1: getEditorInstance 方法
  if (typeof refValue.getEditorInstance === 'function') {
    const editor = refValue.getEditorInstance()
    if (editor) {
      editorInstance.value = editor
      return editor
    }
  }
  
  // 方法2: 直接访问 editor 属性
  if (refValue.editor) {
    editorInstance.value = refValue.editor
    return refValue.editor
  }
  
  // 方法3: 访问 $editor 属性
  if (refValue.$editor) {
    editorInstance.value = refValue.$editor
    return refValue.$editor
  }
  
  // 方法4: 访问 getMonacoInstance 方法
  if (typeof refValue.getMonacoInstance === 'function') {
    const editor = refValue.getMonacoInstance()
    if (editor) {
      editorInstance.value = editor
      return editor
    }
  }
  
  // 方法5: 尝试访问内部属性
  if (refValue.$ && refValue.$.exposed) {
    const exposed = refValue.$.exposed
    if (exposed.getEditorInstance && typeof exposed.getEditorInstance === 'function') {
      const editor = exposed.getEditorInstance()
      if (editor) {
        editorInstance.value = editor
        return editor
      }
    }
  }
  
  return null
}

// 设置 Monaco Editor 快捷键
function setupMonacoShortcuts() {
  const editor = getEditorInstance()
  if (!editor) {
    console.warn('[Playground] Cannot setup shortcuts: editor not available')
    return
  }
  
  try {
    // Ctrl+S / Cmd+S - 保存并运行
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (!isRunning.value) {
        runCode()
      }
    })
    
    // Ctrl+Enter / Cmd+Enter - 运行代码
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (!isRunning.value) {
        runCode()
      }
    })
    
    // Ctrl+Shift+F / Cmd+Shift+F - 格式化代码
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.formatDocument')?.run()
    })
    
    // Ctrl+/ / Cmd+/ - 切换注释（这个已经内置，只是确保可用）
    // editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
    //   editor.getAction('editor.action.commentLine')?.run()
    // })
    
  } catch (err) {
    console.warn('[Playground] Failed to setup shortcuts:', err)
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.addEventListener('msfullscreenchange', handleFullscreenChange)
  
  // 监听主题变化
  themeObserver = observeThemeChange()
  
  // 也监听 storage 变化（如果主题是通过 localStorage 切换的）
  window.addEventListener('storage', () => {
    isDark.value = checkIsDark()
  })
  
  // 等待 Monaco Editor 初始化后设置快捷键
  setTimeout(() => {
    setupMonacoShortcuts()
  }, 500)
  
  // 监听编辑器实例变化
  watch(() => monacoEditorRef.value, () => {
    if (monacoEditorRef.value) {
      setTimeout(() => {
        setupMonacoShortcuts()
      }, 100)
    }
  })
  
  // 初始自动运行一次
  setTimeout(() => {
    runCode()
  }, 800)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.removeEventListener('msfullscreenchange', handleFullscreenChange)
  
  if (themeObserver) {
    themeObserver.disconnect()
  }
  
  window.removeEventListener('storage', () => {
    isDark.value = checkIsDark()
  })
})
</script>

<style scoped lang="scss">
@use '@src/styles/abstracts/variables' as *;
@use '@src/styles/abstracts/mixins' as *;

// ============================================
// Playground Component
// Design Baseline: 1920px
// Spacing Base: 8px
// Design Style: Clean / Enterprise / Minimalist
// ============================================

.playground {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 180px);
  padding-bottom: $spacing-lg;
  background: var(--bg-base);
  overflow: hidden;
  font-family: var(--font-family-base);

  &--fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    height: 100vh;
    z-index: $z-index-modal;
    background: var(--bg-base);
  }

  // 工具栏
  &__toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: $spacing-md;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
    min-height: 56px; // 7 * 8px

    &-left,
    &-right {
      display: flex;
      align-items: center;
      gap: $spacing-md;
    }
  }

  &__status {
    margin-left: $spacing-md;
    font-size: $font-size-small-desktop;
    font-weight: 500; // medium
  }

  // 主内容区
  &__content {
    display: flex;
    flex: 1;
    overflow: hidden;
    background: var(--bg-base);
    min-height: 0;
    position: relative;
  }

  // 编辑器区域
  &__editor {
    flex: 0 0 50%;
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    min-width: 300px;
    border-right: 1px solid var(--border-default);
    transition: all $transition-base;

    &--hidden {
      display: none;
    }

    &-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: $spacing-sm $spacing-md;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border-default);
      flex-shrink: 0;
      min-height: 40px; // 5 * 8px
    }

    &-title {
      @include typography-body;
      font-weight: 600; // semibold
      color: var(--text-primary);
      font-size: $font-size-body-desktop;
    }

    &-wrapper {
      flex: 1;
      min-height: 0;
      position: relative;
      overflow: hidden;
    }
  }

  &__monaco {
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  // 预览区域
  &__preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    min-width: 300px;
    overflow: hidden;
    transition: all $transition-base;

    &--full {
      flex: 1 1 100%;
    }

    &-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: $spacing-sm $spacing-md;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border-default);
      flex-shrink: 0;
      min-height: 40px; // 5 * 8px
    }

    &-title {
      @include typography-body;
      font-weight: 600; // semibold
      color: var(--text-primary);
      font-size: $font-size-body-desktop;
    }

    &-content {
      flex: 1;
      overflow: auto;
      padding: $spacing-lg;
      min-height: 0;
      background: var(--bg-base);
    }
  }

  // 错误显示
  &__error {
    margin-bottom: $spacing-md;
  }

  // 空状态
  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 300px;
    color: var(--text-secondary);
  }
  
  &__shortcuts {
    margin-top: $spacing-md;
    font-size: $font-size-small-desktop;
    color: var(--text-secondary);
    
    p {
      margin: $spacing-xs 0;
      line-height: 1.8;
    }
    
    kbd {
      display: inline-block;
      padding: 2px 8px;
      background: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: $radius-sm;
      font-family: var(--font-family-mono);
      font-size: $font-size-aux-desktop;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      margin: 0 2px;
    }
  }

  // 渲染区域
  &__render {
    width: 100%;
    min-height: 100%;
  }

  // 状态面板
  &__state {
    border-top: 1px solid var(--border-default);
    background: var(--bg-card);
    max-height: 300px;
    overflow: auto;
    flex-shrink: 0;

    &-header {
      padding: $spacing-sm $spacing-md;
      @include typography-body;
      font-weight: 600; // semibold
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-default);
      font-size: $font-size-body-desktop;
    }

    &-content {
      padding: $spacing-md;

      pre {
        margin: 0;
        font-size: $font-size-aux-desktop;
        line-height: $line-height-body;
        color: var(--text-secondary);
        background: var(--bg-base);
        padding: $spacing-md;
        border-radius: $radius-md;
        overflow: auto;
        font-family: var(--font-family-mono);
        border: 1px solid var(--border-default);
      }
    }
  }
}

// ============================================
// Responsive Design (Desktop First)
// ============================================

@include respond-below(sm) {
  .playground {
    height: calc(100vh - 100px);

    &__content {
      flex-direction: column;
    }

    &__editor,
    &__preview {
      flex: 1;
      min-height: 300px;
    }

    &__toolbar {
      padding: $spacing-sm $spacing-md;
      flex-wrap: wrap;
      gap: $spacing-sm;

      &-left,
      &-right {
        flex: 1;
        min-width: 0;
      }
    }
  }
}

@include respond-below(xs) {
  .playground {
    &__toolbar {
      flex-direction: column;
      align-items: stretch;

      &-left,
      &-right {
        justify-content: center;
      }
    }

    &__editor-header,
    &__preview-header {
      padding: $spacing-xs $spacing-sm;
      font-size: $font-size-small-mobile;
    }

    &__preview-content {
      padding: $spacing-md;
    }
  }
}
</style>