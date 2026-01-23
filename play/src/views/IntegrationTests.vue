<template>
  <div class="integration-tests-view">
    <!-- 抽屉：示例列表 -->
    <el-drawer
      v-model="drawerVisible"
      :title="$t('integrationTests.exampleList')"
      :size="320"
      direction="ltr"
      :with-header="true"
      class="examples-drawer"
    >
      <template #header>
        <div class="drawer-header">
          <span>{{ $t('integrationTests.exampleList') }}</span>
        </div>
      </template>
      
      <div class="drawer-content">
        <div class="drawer-controls">
          <el-button-group size="small" class="mode-switch">
            <el-button 
              :type="categoryMode === 'category' ? 'primary' : 'default'"
              @click="categoryMode = 'category'"
            >
              {{ $t('integrationTests.category') }}
            </el-button>
            <el-button 
              :type="categoryMode === 'level' ? 'primary' : 'default'"
              @click="categoryMode = 'level'"
            >
              {{ $t('integrationTests.complexity') }}
            </el-button>
          </el-button-group>
          <el-input
            v-model="searchQuery"
            :placeholder="$t('integrationTests.search')"
            clearable
            size="small"
            prefix-icon="Search"
            class="search-input"
          />
        </div>
        <div class="tree-container">
          <el-tree
            :data="filteredTreeData"
            :props="treeProps"
            :default-expand-all="true"
            :highlight-current="true"
            :current-node-key="activeDemo"
            node-key="id"
            @node-click="handleNodeClick"
            class="demo-tree"
          >
            <template #default="{ node, data }">
              <span class="tree-node">
                <el-icon v-if="data.icon" class="node-icon">
                  <component :is="data.icon" />
                </el-icon>
                <span class="node-label">{{ node.label }}</span>
                <el-tag v-if="data.level" :type="getLevelType(data.level)" size="small" class="level-tag">
                  {{ data.level }}
                </el-tag>
              </span>
            </template>
          </el-tree>
        </div>
      </div>
    </el-drawer>

    <div class="layout-container">

      <!-- 中间：效果预览（主区域） -->
      <div 
        class="main-content" 
        :class="{ 'is-resizing': isResizing }"
        :style="showSourceCode ? { width: typeof mainContentWidth === 'number' ? `${mainContentWidth}px` : mainContentWidth } : {}"
      >
        <div class="content-header">
          <div class="header-left">
            <el-button 
              text
              circle
              @click="drawerVisible = true"
              class="menu-btn"
            >
              <el-icon><Menu /></el-icon>
            </el-button>
            <h2>{{ activeDemoTitle || $t('integrationTests.selectExample') }}</h2>
          </div>
          <el-button 
            v-if="activeDemo && !showSourceCode"
            text
            @click="toggleSourceCode"
            size="default"
            class="view-code-btn"
          >
            <el-icon><Document /></el-icon>
            <span>{{ $t('integrationTests.viewSourceCode') }}</span>
          </el-button>
        </div>
        <div class="preview-container">
          <VNodeRenderer :vnode="vnode" v-if="vnode" />
          <div v-else class="loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <p>加载中...</p>
          </div>
        </div>
      </div>

      <!-- 拖动分隔条 -->
      <div 
        v-if="showSourceCode"
        class="resizer"
        @mousedown="startResize"
      >
        <div class="resizer-handle"></div>
      </div>

      <!-- 右侧：源码（可切换显示/隐藏） -->
      <el-collapse-transition>
        <div 
          v-show="showSourceCode" 
          class="code-sidebar" 
          :class="{ 'is-resizing': isResizing }"
          :style="{ width: typeof codeSidebarWidth === 'number' ? `${codeSidebarWidth}px` : codeSidebarWidth }"
        >
          <div class="code-header">
            <div class="code-title">
              <el-icon><Document /></el-icon>
              <span>{{ sourceFileName }}</span>
            </div>
            <el-button 
              text
              circle
              size="small"
              @click="showSourceCode = false"
              class="close-btn"
            >
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
          <div class="code-container">
            <div v-if="sourceCode" class="code-wrapper">
              <div class="line-numbers" ref="lineNumbersRef"></div>
              <pre class="source-code"><code ref="codeRef" class="language-typescript">{{ sourceCode }}</code></pre>
            </div>
            <div v-else class="loading-code">
              <el-icon class="is-loading"><Loading /></el-icon>
              <p>加载源码中...</p>
            </div>
          </div>
        </div>
      </el-collapse-transition>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, watch, getCurrentInstance, defineComponent, h, nextTick, computed, onMounted } from 'vue'
import type { VNode } from 'vue'
import { useI18n } from 'vue-i18n'
import { 
  DocumentChecked, Edit, DataBoard, Operation, ShoppingCart, 
  Document, Search, Plus, Loading, Close, Menu
} from '@element-plus/icons-vue'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { createTodoApp } from '../examples/todo-app.vario'
import { createFormDemo } from '../examples/form-demo.vario'
import { createDataTable } from '../examples/data-table.vario'
import { createCalculator } from '../examples/calculator.vario'
import { createShoppingCart } from '../examples/shopping-cart.vario'
import { createCounter } from '../examples/counter.vario'
import { createSearchFilter } from '../examples/search-filter.vario'

// 获取当前组件实例的 app，用于传递给示例函数
const instance = getCurrentInstance()
const app = instance?.appContext.app
const { t: $t } = useI18n()

// VNode 渲染器组件
const VNodeRenderer = defineComponent({
  name: 'VNodeRenderer',
  props: {
    vnode: {
      type: Object as () => VNode | null,
      default: null
    }
  },
  render() {
    return this.vnode || h('div', 'Loading...')
  }
})

// 示例数据配置
interface DemoItem {
  id: string
  label: string
  icon?: any
  level?: '简单' | '中等' | '复杂'
  category?: string
  description?: string
}

interface TreeNode extends DemoItem {
  children?: TreeNode[]
}

const demos: DemoItem[] = [
  { id: 'counter', label: '计数器', icon: Plus, level: '简单', category: '基础', description: '基础状态管理和事件处理' },
  { id: 'calculator', label: '计算器', icon: Operation, level: '简单', category: '基础', description: '基础计算功能' },
  { id: 'todo', label: '待办事项', icon: DocumentChecked, level: '中等', category: '应用', description: '完整的 Todo 应用' },
  { id: 'form', label: '表单', icon: Edit, level: '中等', category: '表单', description: '复杂表单处理' },
  { id: 'search', label: '搜索过滤', icon: Search, level: '中等', category: '数据', description: '列表搜索和过滤' },
  { id: 'table', label: '数据表格', icon: DataBoard, level: '复杂', category: '数据', description: '数据表格展示' },
  { id: 'cart', label: '购物车', icon: ShoppingCart, level: '复杂', category: '应用', description: '购物车功能' }
]

// 构建树形数据（按类别分类）
const treeData = computed<TreeNode[]>(() => {
  const categories: Record<string, TreeNode> = {}
  
  demos.forEach(demo => {
    const category = demo.category || '其他'
    if (!categories[category]) {
      categories[category] = {
        id: `category-${category}`,
        label: category,
        children: []
      }
    }
    categories[category].children!.push(demo)
  })
  
  return Object.values(categories)
})

// 构建树形数据（按复杂度分类）
const treeDataByLevel = computed<TreeNode[]>(() => {
  const levels: Record<string, TreeNode> = {}
  
  demos.forEach(demo => {
    const level = demo.level || '其他'
    if (!levels[level]) {
      levels[level] = {
        id: `level-${level}`,
        label: level,
        children: []
      }
    }
    levels[level].children!.push(demo)
  })
  
  return Object.values(levels)
})

// 当前分类模式
const categoryMode = ref<'category' | 'level'>('category')
const drawerVisible = ref(false)

// 搜索查询
const searchQuery = ref('')

// 过滤后的树形数据
const filteredTreeData = computed(() => {
  const data = categoryMode.value === 'category' ? treeData.value : treeDataByLevel.value
  
  if (!searchQuery.value) {
    return data
  }
  
  const query = searchQuery.value.toLowerCase()
  const filterNode = (node: TreeNode): TreeNode | null => {
    const labelMatch = node.label.toLowerCase().includes(query)
    const childrenMatch = node.children?.some(child => 
      child.label.toLowerCase().includes(query) || 
      child.description?.toLowerCase().includes(query)
    )
    
    if (labelMatch || childrenMatch) {
      return {
        ...node,
        children: node.children?.filter(child => 
          child.label.toLowerCase().includes(query) || 
          child.description?.toLowerCase().includes(query)
        )
      }
    }
    
    return null
  }
  
  return data.map(filterNode).filter(Boolean) as TreeNode[]
})

const treeProps = {
  children: 'children',
  label: 'label'
}

// 状态管理
const activeDemo = ref<string | null>(null)
const activeDemoTitle = ref('')
const vnode = ref<VNode | null>(null)
const showSourceCode = ref(false)
const sourceCode = ref<string>('')
const sourceFileName = ref<string>('')
const codeRef = ref<HTMLElement | null>(null)
const lineNumbersRef = ref<HTMLElement | null>(null)

// 分屏宽度控制（使用像素值，更精确）
const mainContentWidth = ref<number | string>('50%') // 默认效果区域占 50%
const codeSidebarWidth = ref<number | string>('50%') // 默认源码区域占 50%
const isResizing = ref(false)

const demoCreators: Record<string, (app?: any) => { vnode: any }> = {
  todo: createTodoApp,
  form: createFormDemo,
  table: createDataTable,
  calculator: createCalculator,
  cart: createShoppingCart,
  counter: createCounter,
  search: createSearchFilter
}

const demoTitles: Record<string, string> = {
  todo: '待办事项',
  form: '表单',
  table: '数据表格',
  calculator: '计算器',
  cart: '购物车',
  counter: '计数器',
  search: '搜索过滤'
}

const getLevelType = (level: string) => {
  const map: Record<string, 'success' | 'warning' | 'danger'> = {
    '简单': 'success',
    '中等': 'warning',
    '复杂': 'danger'
  }
  return map[level] || 'info'
}

const loadSourceCode = async (demoType: string) => {
  const fileNameMap: Record<string, string> = {
    todo: 'todo-app.vario.ts',
    form: 'form-demo.vario.ts',
    table: 'data-table.vario.ts',
    calculator: 'calculator.vario.ts',
    cart: 'shopping-cart.vario.ts',
    counter: 'counter.vario.ts',
    search: 'search-filter.vario.ts'
  }
  sourceFileName.value = fileNameMap[demoType] || `${demoType}.vario.ts`
  
  try {
    const fileBaseNameMap: Record<string, string> = {
      todo: 'todo-app',
      form: 'form-demo',
      table: 'data-table',
      calculator: 'calculator',
      cart: 'shopping-cart',
      counter: 'counter',
      search: 'search-filter'
    }
    const fileBaseName = fileBaseNameMap[demoType] || demoType
    const codeModule = await import(`../examples/${fileBaseName}.vario.ts?raw`)
    sourceCode.value = codeModule.default || '// 源码加载失败'
    
    await nextTick()
    highlightCode()
  } catch (error) {
    console.error('Failed to load source code:', error)
    sourceCode.value = `// 无法加载源码: ${error instanceof Error ? error.message : String(error)}`
  }
}

const highlightCode = () => {
  if (codeRef.value) {
    hljs.highlightElement(codeRef.value)
    addLineNumbers()
  }
}

const addLineNumbers = () => {
  if (!codeRef.value || !lineNumbersRef.value) return
  
  const code = codeRef.value
  const lines = code.textContent?.split('\n') || []
  const lineNumbers = lines.map((_, index) => index + 1).join('\n')
  
  lineNumbersRef.value.textContent = lineNumbers
}

const startDemo = async (demoType: string) => {
  const creator = demoCreators[demoType]
  
  if (!creator) {
    console.error(`Unknown demo type: ${demoType}`)
    return
  }
  
  activeDemo.value = demoType
  activeDemoTitle.value = demoTitles[demoType] || '演示'
  showSourceCode.value = false
  sourceCode.value = ''
  
  await loadSourceCode(demoType)
  
  const { vnode: appVnode } = creator(app)
  vnode.value = appVnode.value
  
  watch(appVnode, (newVnode) => {
    vnode.value = newVnode
  }, { immediate: true })
}

const handleNodeClick = (data: TreeNode) => {
  // 只处理叶子节点（示例项）
  if (!data.children && data.id && data.id.startsWith('category-') === false && data.id.startsWith('level-') === false) {
    startDemo(data.id)
    // 选择示例后自动关闭抽屉
    drawerVisible.value = false
  }
}

const toggleSourceCode = async () => {
  showSourceCode.value = !showSourceCode.value
  
  // 初始化宽度为百分比，后续拖动时转换为像素值
  if (showSourceCode.value) {
    await nextTick()
    const container = document.querySelector('.layout-container') as HTMLElement
    if (container) {
      const availableWidth = container.clientWidth
      mainContentWidth.value = availableWidth * 0.5
      codeSidebarWidth.value = availableWidth * 0.5
    }
    
    await nextTick()
    highlightCode()
  } else {
    // 重置为百分比，以便下次显示时重新计算
    mainContentWidth.value = '50%'
    codeSidebarWidth.value = '50%'
  }
}

// 拖动调整宽度
const startResize = (e: MouseEvent) => {
  isResizing.value = true
  e.preventDefault()
  e.stopPropagation()
  
  // 禁用文本选择
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  
  const container = document.querySelector('.layout-container') as HTMLElement
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  const startX = e.clientX
  const startMainWidth = typeof mainContentWidth.value === 'number' 
    ? mainContentWidth.value 
    : containerRect.width * (parseFloat(mainContentWidth.value) / 100)
  
  let rafId: number | null = null
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return
    
    // 使用 requestAnimationFrame 优化性能
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
    
    rafId = requestAnimationFrame(() => {
      const currentX = e.clientX
      const deltaX = currentX - startX
      const newMainWidth = startMainWidth + deltaX
      
      const containerWidth = container.clientWidth
      const availableWidth = containerWidth
      
      // 限制宽度范围：效果区域最小 300px，最大 availableWidth - 300px
      const minMainWidth = 300
      const maxMainWidth = availableWidth - 300
      
      if (newMainWidth >= minMainWidth && newMainWidth <= maxMainWidth) {
        mainContentWidth.value = newMainWidth
        codeSidebarWidth.value = availableWidth - newMainWidth
      }
    })
  }
  
  const handleMouseUp = () => {
    isResizing.value = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove, { passive: true })
  document.addEventListener('mouseup', handleMouseUp)
}

// 默认显示第一个例子
onMounted(() => {
  if (demos.length > 0) {
    startDemo(demos[0].id)
  }
  // 默认打开抽屉
  drawerVisible.value = true
})
</script>

<style scoped lang="scss">
.integration-tests-view {
  height: calc(100vh - 120px);
  overflow: hidden;
  position: relative;
}

.layout-container {
  display: flex;
  height: 100%;
  gap: 0;
}

// 抽屉样式
.examples-drawer {
  .drawer-header {
    font-size: 16px;
    font-weight: 600;
  }
  
  .drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    
    .drawer-controls {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--el-border-color);
      margin-bottom: 16px;
      
      .mode-switch {
        width: 100%;
        display: flex;
        
        .el-button {
          flex: 1;
        }
      }
      
      .search-input {
        width: 100%;
      }
    }
    
    .tree-container {
      flex: 1;
      overflow: auto;
      padding: 8px;
      
      .demo-tree {
        .tree-node {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          
          .node-icon {
            font-size: 16px;
          }
          
          .node-label {
            flex: 1;
          }
          
          .level-tag {
            margin-left: auto;
          }
        }
      }
    }
  }
}

// 拖动分隔条
.resizer {
  width: 4px;
  background: var(--el-border-color);
  cursor: col-resize;
  position: relative;
  flex-shrink: 0;
  transition: background 0.15s;
  z-index: 10;
  
  &:hover {
    background: var(--el-color-primary);
    width: 6px;
  }
  
  &:active {
    background: var(--el-color-primary);
    width: 6px;
  }
  
  .resizer-handle {
    position: absolute;
    left: -4px;
    top: 0;
    width: 12px;
    height: 100%;
    cursor: col-resize;
    z-index: 11;
  }
}

// 中间：效果预览（主区域）
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  overflow: hidden;
  min-width: 0; // 允许 flex 收缩
  
  &.is-resizing {
    transition: none; // 拖动时禁用过渡，提升流畅度
    user-select: none;
  }
  
  .content-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--el-border-color);
    flex-shrink: 0;
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .menu-btn {
        flex-shrink: 0;
      }
      
      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }
    }
    
    .view-code-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--el-color-primary);
      transition: all 0.3s;
      
      &:hover {
        color: var(--el-color-primary-light-3);
      }
    }
  }
  
  .preview-container {
    flex: 1;
    padding: 20px;
    overflow: auto;
    background: var(--el-bg-color-page);
    
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 400px;
      color: var(--el-text-color-secondary);
      
      .el-icon {
        font-size: 24px;
      }
    }
  }
}

// 右侧：源码
.code-sidebar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  overflow: hidden;
  min-width: 0; // 允许 flex 收缩
  
  &.is-resizing {
    transition: none; // 拖动时禁用过渡，提升流畅度
    user-select: none;
  }
  
  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color);
    flex-shrink: 0;
    background: var(--el-bg-color-page);
    
    .code-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      flex: 1;
      min-width: 0;
      
      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    
    .close-btn {
      flex-shrink: 0;
    }
  }
  
  .code-container {
    flex: 1;
    overflow: hidden;
    background: #0d1117;
    position: relative;
    
    .code-wrapper {
      display: flex;
      height: 100%;
      overflow: auto;
      min-height: 0;
      
      .line-numbers {
        flex-shrink: 0;
        width: 50px;
        padding: 16px 8px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
        font-size: 13px;
        line-height: 1.6;
        color: #6e7681;
        background: #161b22;
        border-right: 1px solid #30363d;
        user-select: none;
        text-align: right;
        white-space: pre;
      }
      
      .source-code {
        flex: 1;
        margin: 0;
        padding: 16px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
        font-size: 13px;
        line-height: 1.6;
        color: #c9d1d9;
        white-space: pre;
        overflow-x: auto;
        background: transparent;
        min-height: 0;
        
        code {
          display: block;
          padding: 0;
          background: transparent;
          border: none;
          color: inherit;
          font-family: inherit;
          font-size: inherit;
          white-space: pre;
          word-wrap: normal;
        }
      }
    }
    
    .loading-code {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 300px;
      color: var(--el-text-color-secondary);
      
      .el-icon {
        font-size: 24px;
      }
    }
  }
}

</style>
