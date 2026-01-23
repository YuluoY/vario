<template>
  <div class="examples-view">
    <div class="page-header">
      <h1>{{ $t('examples.title') }}</h1>
      <p>{{ $t('examples.subtitle') }}</p>
    </div>

    <el-row :gutter="24">
      <el-col :xs="24" :md="12">
        <el-card class="example-card">
          <template #header>
            <div class="card-header">
              <el-icon><Lightning /></el-icon>
              <span>{{ $t('examples.quickStart') }}</span>
            </div>
          </template>
          
          <el-steps :active="0" simple class="mb-4">
            <el-step :title="$t('examples.step1')" icon="Document" />
            <el-step :title="$t('examples.step2')" icon="Connection" />
            <el-step :title="$t('examples.step3')" icon="View" />
          </el-steps>

          <div class="code-example">
            <pre><code>{{ quickStartExample }}</code></pre>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="example-card">
          <template #header>
            <div class="card-header">
              <el-icon><DocumentChecked /></el-icon>
              <span>{{ $t('examples.schemaExamples') }}</span>
            </div>
          </template>

          <el-collapse v-model="activeSchemaExamples">
            <el-collapse-item :title="$t('examples.buttonComponent')" name="button">
              <pre><code>{{ buttonExample }}</code></pre>
            </el-collapse-item>
            <el-collapse-item :title="$t('examples.formInput')" name="input">
              <pre><code>{{ inputExample }}</code></pre>
            </el-collapse-item>
            <el-collapse-item :title="$t('examples.listWithLoop')" name="list">
              <pre><code>{{ listExample }}</code></pre>
            </el-collapse-item>
            <el-collapse-item :title="$t('examples.conditionalRendering')" name="cond">
              <pre><code>{{ conditionalExample }}</code></pre>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-6">
      <el-col :xs="24" :md="12">
        <el-card class="example-card">
          <template #header>
            <div class="card-header">
              <el-icon><Operation /></el-icon>
              <span>{{ $t('examples.instructionExamples') }}</span>
            </div>
          </template>

          <el-collapse v-model="activeInstructionExamples">
            <el-collapse-item :title="$t('examples.setValue')" name="set">
              <pre><code>{{ setInstruction }}</code></pre>
            </el-collapse-item>
            <el-collapse-item :title="$t('examples.conditionalBranch')" name="if">
              <pre><code>{{ ifInstruction }}</code></pre>
            </el-collapse-item>
            <el-collapse-item :title="$t('examples.loopExecution')" name="loop">
              <pre><code>{{ loopInstruction }}</code></pre>
            </el-collapse-item>
            <el-collapse-item :title="$t('examples.eventEmission')" name="emit">
              <pre><code>{{ emitInstruction }}</code></pre>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="example-card">
          <template #header>
            <div class="card-header">
              <el-icon><DataAnalysis /></el-icon>
              <span>{{ $t('examples.expressionExamples') }}</span>
            </div>
          </template>

          <el-collapse v-model="activeExpressionExamples">
            <el-collapse-item :title="$t('examples.propertyAccess')" name="access">
              <pre><code>{{ accessExpression }}</code></pre>
            </el-collapse-item>
            <el-collapse-item :title="$t('examples.mathOperations')" name="math">
              <pre><code>{{ mathExpression }}</code></pre>
            </el-collapse-item>
            <el-collapse-item :title="$t('examples.arrayMethods')" name="array">
              <pre><code>{{ arrayExpression }}</code></pre>
            </el-collapse-item>
            <el-collapse-item :title="$t('examples.conditional')" name="conditional">
              <pre><code>{{ conditionalExpression }}</code></pre>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-6">
      <el-col :xs="24">
        <el-card class="example-card">
          <template #header>
            <div class="card-header">
              <el-icon><Link /></el-icon>
              <span>{{ $t('examples.resources') }}</span>
            </div>
          </template>

          <el-row :gutter="24">
            <el-col :xs="24" :sm="8">
              <div class="resource-item">
                <h3>{{ $t('examples.documentation') }}</h3>
                <p>{{ $t('examples.completeApiReference') }}</p>
                <el-button type="primary" link>{{ $t('examples.viewDocs') }} →</el-button>
              </div>
            </el-col>
            <el-col :xs="24" :sm="8">
              <div class="resource-item">
                <h3>{{ $t('examples.github') }}</h3>
                <p>{{ $t('examples.sourceCodeAndContributions') }}</p>
                <el-button type="primary" link>{{ $t('examples.viewRepo') }} →</el-button>
              </div>
            </el-col>
            <el-col :xs="24" :sm="8">
              <div class="resource-item">
                <h3>{{ $t('examples.community') }}</h3>
                <p>{{ $t('examples.joinDiscussionsAndHelp') }}</p>
                <el-button type="primary" link>{{ $t('examples.join') }} →</el-button>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Lightning,
  DocumentChecked,
  Operation,
  DataAnalysis,
  Link
} from '@element-plus/icons-vue'

// @ts-ignore
const { t } = useI18n()

const activeSchemaExamples = ref(['button'])
const activeInstructionExamples = ref(['set'])
const activeExpressionExamples = ref(['access'])

const quickStartExample = `import { useVario } from '@vario/vue'
import type { Schema } from '@vario/schema'

interface CounterState extends Record<string, unknown> {
  count: number
}

const schema: Schema<CounterState> = {
  type: 'ElButton',
  props: { type: 'primary' },
  children: 'Click Me',
  events: {
    click: [
      { type: 'call', method: 'increment' }
    ]
  }
}

const { vnode, state } = useVario(schema, {
  state: { count: 0 },
  methods: {
    increment: ({ state }) => {
      state.count += 1
    }
  }
})`

const buttonExample = `{
  "type": "ElButton",
  "props": {
    "type": "primary",
    "size": "large"
  },
  "events": {
    "click": [
      { "type": "call", "method": "handleClick" }
    ]
  },
  "children": "Click Me"
}`

const inputExample = `{
  "type": "ElInput",
  "props": {
    "placeholder": "Enter text..."
  },
  "model": "inputValue",
  "events": {
    "change": [
      { "type": "call", "method": "onInputChange" }
    ]
  }
}`

const listExample = `{
  "type": "div",
  "props": { "style": "display: flex; flex-wrap: wrap; gap: 10px; padding: 20px;" },
  "children": [
    {
      "type": "h4",
      "props": { "style": "width: 100%; margin-bottom: 10px;" },
      "children": "Items List:"
    },
    {
      "type": "ElTag",
      "loop": {
        "items": "{{ items }}"
      },
      "props": {
        "type": "primary",
        "style": "margin-right: 8px; margin-bottom: 8px;"
      },
      "children": "{{ $index + 1 }}. {{ $record }}"
    }
  ]
}`

const conditionalExample = `{
  "type": "ElAlert",
  "cond": "{{ showSuccess }}",
  "props": {
    "type": "success"
  },
  "children": "Operation successful!"
}`

const setInstruction = `[
  {
    "type": "set",
    "path": "counter",
    "value": "{{ counter + 1 }}"
  },
  {
    "type": "call",
    "method": "logCounter"
  }
]`

const ifInstruction = `[
  {
    "type": "if",
    "cond": "{{ counter < 10 }}",
    "then": [
      { "type": "call", "method": "handleLowCount" }
    ],
    "else": [
      { "type": "call", "method": "handleHighCount" }
    ]
  }
]`

const loopInstruction = `[
  {
    "type": "loop",
    "var": "i",
    "from": 0,
    "to": 5,
    "body": [
      {
        "type": "set",
        "path": "items.{{ i }}",
        "value": "{{ i * 2 }}"
      }
    ]
  }
]`

const emitInstruction = `[
  {
    "type": "emit",
    "event": "user-action",
    "data": {
      "action": "click",
      "timestamp": "{{ Date.now() }}"
    }
  }
]`

const accessExpression = `user.name
user.profile.age
settings.theme`

const mathExpression = `count + 1
price * quantity
Math.max(a, b, c)`

const arrayExpression = `items.length
items.length > 0 ? items.length : 0
items.slice(0, 5).length`

const conditionalExpression = `count < 10 ? "Low" : "High"
active ? "On" : "Off"
type === "success" ? "✓" : "✗"`
</script>

<style scoped lang="scss">
.examples-view {
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

.example-card {
  margin-bottom: var(--space-6);
  height: 100%;

  .card-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: var(--font-weight-semibold);
  }
}

.code-example {
  pre {
    background: var(--color-bg-tertiary);
    padding: var(--space-4);
    border-radius: var(--radius-base);
    overflow-x: auto;
    margin: 0;
    
    code {
      font-family: var(--font-family-mono);
      font-size: var(--font-size-sm);
      line-height: var(--line-height-normal);
    }
  }
}

.resource-item {
  padding: var(--space-4);
  text-align: center;

  h3 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    margin-bottom: var(--space-2);
  }

  p {
    color: var(--color-text-secondary);
    margin-bottom: var(--space-4);
  }
}

.mt-6 {
  margin-top: var(--space-6);
}

.mb-4 {
  margin-bottom: var(--space-4);
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
