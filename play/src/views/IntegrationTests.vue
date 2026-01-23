<template>
  <div class="integration-tests-view">
    <div class="layout-container">
      <!-- 左侧：示例列表侧边栏 -->
      <div 
        class="sidebar" 
        :class="{ 'sidebar--collapsed': sidebarCollapsed, 'is-resizing': isSidebarResizing }"
        :style="{ width: sidebarCollapsed ? '48px' : `${sidebarWidth}px` }"
      >
        <div class="sidebar-header">
          <el-collapse-transition>
            <span v-show="!sidebarCollapsed" class="sidebar-title">{{ $t('integrationTests.exampleList') }}</span>
          </el-collapse-transition>
          <div class="sidebar-actions">
            <!-- 折叠状态下显示菜单图标，点击展开侧边栏 -->
            <el-button 
              v-if="sidebarCollapsed"
              text 
              circle 
              size="small"
              @click="sidebarCollapsed = false"
              class="menu-btn"
              :title="$t('integrationTests.expand')"
            >
              <el-icon><Menu /></el-icon>
            </el-button>
            
            <!-- 展开状态下显示折叠按钮 -->
            <el-button 
              v-if="!sidebarCollapsed"
              text 
              circle 
              size="small"
              @click="sidebarCollapsed = true"
              class="collapse-btn"
              :title="$t('integrationTests.collapse')"
            >
              <el-icon>
                <component :is="ArrowLeft" />
              </el-icon>
            </el-button>
          </div>
        </div>
        
        <el-collapse-transition>
          <div v-show="!sidebarCollapsed" class="sidebar-content">
            <div class="sidebar-controls">
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
        </el-collapse-transition>
      </div>

      <!-- 拖动分隔条（左侧侧边栏） -->
      <div 
        v-if="!sidebarCollapsed"
        class="sidebar-resizer"
        @mousedown="startSidebarResize"
      >
        <div class="resizer-handle"></div>
      </div>

      <!-- 中间：效果预览（主区域） -->
      <div 
        class="main-content" 
        :class="{ 'is-resizing': isResizing }"
        :style="showSourceCode ? { width: typeof mainContentWidth === 'number' ? `${mainContentWidth}px` : mainContentWidth } : {}"
      >
        <div class="content-header">
          <div class="header-left">
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
            <p>{{ $t('integrationTests.loading') }}</p>
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
              <p>{{ $t('integrationTests.loadingSourceCode') }}</p>
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
  Document, Search, Plus, Loading, Close, ArrowLeft, Menu
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
  setup(props) {
    const { t } = useI18n()
    return () => {
      return props.vnode || h('div', t('integrationTests.loading'))
    }
  }
})

// 示例数据配置
interface DemoItem {
  id: string
  labelKey: string
  icon?: any
  levelKey: string
  categoryKey: string
  descriptionKey: string
}

interface TreeNode extends DemoItem {
  label?: string
  level?: string
  category?: string
  description?: string
  children?: TreeNode[]
}

const demos: DemoItem[] = [
  { id: 'counter', labelKey: 'integrationTests.counter', icon: Plus, levelKey: 'integrationTests.simple', categoryKey: 'integrationTests.basic', descriptionKey: 'integrationTests.counterDescription' },
  { id: 'calculator', labelKey: 'integrationTests.calculator', icon: Operation, levelKey: 'integrationTests.simple', categoryKey: 'integrationTests.basic', descriptionKey: 'integrationTests.calculatorDescription' },
  { id: 'todo', labelKey: 'integrationTests.todo', icon: DocumentChecked, levelKey: 'integrationTests.medium', categoryKey: 'integrationTests.application', descriptionKey: 'integrationTests.todoDescription' },
  { id: 'form', labelKey: 'integrationTests.form', icon: Edit, levelKey: 'integrationTests.medium', categoryKey: 'integrationTests.formCategory', descriptionKey: 'integrationTests.formDescription' },
  { id: 'search', labelKey: 'integrationTests.searchFilter', icon: Search, levelKey: 'integrationTests.medium', categoryKey: 'integrationTests.data', descriptionKey: 'integrationTests.searchFilterDescription' },
  { id: 'table', labelKey: 'integrationTests.dataTable', icon: DataBoard, levelKey: 'integrationTests.complex', categoryKey: 'integrationTests.data', descriptionKey: 'integrationTests.dataTableDescription' },
  { id: 'cart', labelKey: 'integrationTests.shoppingCart', icon: ShoppingCart, levelKey: 'integrationTests.complex', categoryKey: 'integrationTests.application', descriptionKey: 'integrationTests.shoppingCartDescription' }
]

// 构建树形数据（按类别分类）
const treeData = computed<TreeNode[]>(() => {
  const categories: Record<string, TreeNode> = {}
  
  demos.forEach(demo => {
    const categoryKey = demo.categoryKey
    const categoryLabel = $t(categoryKey) as string
    if (!categories[categoryKey]) {
      categories[categoryKey] = {
        id: `category-${categoryKey}`,
        label: categoryLabel,
        labelKey: categoryKey,
        levelKey: '',
        categoryKey: '',
        descriptionKey: '',
        children: []
      }
    }
    categories[categoryKey].children!.push({
      ...demo,
      label: $t(demo.labelKey) as string,
      level: $t(demo.levelKey) as string,
      category: categoryLabel,
      description: $t(demo.descriptionKey) as string
    })
  })
  
  return Object.values(categories)
})

// 构建树形数据（按复杂度分类）
const treeDataByLevel = computed<TreeNode[]>(() => {
  const levels: Record<string, TreeNode> = {}
  
  demos.forEach(demo => {
    const levelKey = demo.levelKey
    const levelLabel = $t(levelKey) as string
    if (!levels[levelKey]) {
      levels[levelKey] = {
        id: `level-${levelKey}`,
        label: levelLabel,
        labelKey: levelKey,
        levelKey: '',
        categoryKey: '',
        descriptionKey: '',
        children: []
      }
    }
    levels[levelKey].children!.push({
      ...demo,
      label: $t(demo.labelKey) as string,
      level: levelLabel,
      category: $t(demo.categoryKey) as string,
      description: $t(demo.descriptionKey) as string
    })
  })
  
  return Object.values(levels)
})

// 当前分类模式
const categoryMode = ref<'category' | 'level'>('category')
const sidebarCollapsed = ref(false)
const sidebarWidth = ref(320)
const isSidebarResizing = ref(false)

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
    const nodeLabel = node.label || ''
    const labelMatch = nodeLabel.toLowerCase().includes(query)
    const childrenMatch = node.children?.some(child => {
      const childLabel = child.label || ''
      const childDesc = child.description || ''
      return childLabel.toLowerCase().includes(query) || childDesc.toLowerCase().includes(query)
    })
    
    if (labelMatch || childrenMatch) {
      return {
        ...node,
        children: node.children?.filter(child => {
          const childLabel = child.label || ''
          const childDesc = child.description || ''
          return childLabel.toLowerCase().includes(query) || childDesc.toLowerCase().includes(query)
        })
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
  todo: $t('integrationTests.todo') as string,
  form: $t('integrationTests.form') as string,
  table: $t('integrationTests.dataTable') as string,
  calculator: $t('integrationTests.calculator') as string,
  cart: $t('integrationTests.shoppingCart') as string,
  counter: $t('integrationTests.counter') as string,
  search: $t('integrationTests.searchFilter') as string
}

const getLevelType = (level: string) => {
  const simple = $t('integrationTests.simple') as string
  const medium = $t('integrationTests.medium') as string
  const complex = $t('integrationTests.complex') as string
  const map: Record<string, 'success' | 'warning' | 'danger'> = {
    [simple]: 'success',
    [medium]: 'warning',
    [complex]: 'danger'
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
    sourceCode.value = `// ${$t('integrationTests.failedToLoadSource')}: ${error instanceof Error ? error.message : String(error)}`
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
  activeDemoTitle.value = demoTitles[demoType] || ($t('integrationTests.demo') as string)
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

// 侧边栏拖动调整宽度
const startSidebarResize = (e: MouseEvent) => {
  isSidebarResizing.value = true
  e.preventDefault()
  e.stopPropagation()
  
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  
  let rafId: number | null = null
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isSidebarResizing.value) return
    
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
    
    rafId = requestAnimationFrame(() => {
      const currentX = e.clientX
      const deltaX = currentX - startX
      const newWidth = startWidth + deltaX
      
      // 限制宽度范围：最小 200px，最大 500px
      const minWidth = 200
      const maxWidth = 500
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        sidebarWidth.value = newWidth
      }
    })
  }
  
  const handleMouseUp = () => {
    isSidebarResizing.value = false
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
})
</script>

<style scoped lang="scss">
@use '../styles/abstracts/variables' as *;
@use '../styles/abstracts/mixins' as *;

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

// 左侧侧边栏
.sidebar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border-right: 1px solid var(--border-default);
  overflow: hidden;
  transition: width 0.2s ease;
  
  &.is-resizing {
    transition: none;
    user-select: none;
  }
  
  &--collapsed {
    .sidebar-header {
      justify-content: center;
      padding: $spacing-md $spacing-xs;
    }
    
    .sidebar-title {
      display: none;
    }
    
    .sidebar-actions {
      width: 100%;
      display: flex;
      justify-content: center;
    }
  }
  
  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: $spacing-md;
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
    min-height: 48px;
    
    .sidebar-title {
      font-size: $font-size-h4-desktop;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .sidebar-actions {
      display: flex;
      align-items: center;
      gap: $spacing-xs;
      flex-shrink: 0;
    }
    
    .collapse-btn,
    .menu-btn {
      color: var(--text-secondary);
      flex-shrink: 0;
      
      &:hover {
        color: var(--primary-base);
      }
    }
  }
  
  .sidebar-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    
    .sidebar-controls {
      display: flex;
      flex-direction: column;
      gap: $spacing-md;
      padding: $spacing-md;
      border-bottom: 1px solid var(--border-default);
      flex-shrink: 0;
      
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
      padding: $spacing-xs 0;
      background: var(--bg-card);
      
      .demo-tree {
        background: var(--bg-card);
        padding: 0 $spacing-md;
        
        :deep(.el-tree-node) {
          margin-bottom: $spacing-xs;
          background: var(--bg-card);
          
          .el-tree-node__content {
            padding: $spacing-sm 0;
            min-height: 36px;
            height: auto;
            background: var(--bg-card);
            
            &:hover {
              background-color: var(--bg-hover);
            }
          }
          
          &.is-current > .el-tree-node__content {
            background-color: var(--bg-hover);
          }
        }
        
        :deep(.el-tree-node__expand-icon) {
          margin-right: $spacing-xs;
        }
        
        .tree-node {
          display: flex;
          align-items: center;
          gap: $spacing-sm;
          flex: 1;
          padding-right: $spacing-sm;
          min-width: 0;
          
          .node-icon {
            font-size: $font-size-h4-desktop;
            flex-shrink: 0;
            color: var(--text-secondary);
          }
          
          .node-label {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: var(--text-primary);
          }
          
          .level-tag {
            margin-left: auto;
            flex-shrink: 0;
            margin-right: 0;
          }
        }
      }
    }
  }
}

// 侧边栏拖动分隔条
.sidebar-resizer {
  width: 4px;
  background: var(--border-default);
  cursor: col-resize;
  position: relative;
  flex-shrink: 0;
  transition: background 0.15s;
  z-index: 10;
  
  &:hover {
    background: var(--primary-base);
    width: 6px;
  }
  
  &:active {
    background: var(--primary-base);
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

// 中间和右侧之间的拖动分隔条
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
