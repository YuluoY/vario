/**
 * Development server for Vario projects
 *
 * 功能：
 * - 文件监听（Schema JSON / .ts 文件）
 * - 变更时自动验证 + 重新生成代码
 * - 控制台实时反馈
 *
 * 设计约束：
 * - 不引入外部重依赖（chokidar/vite），使用 Node.js 原生 fs.watch
 * - CLI 包保持轻量，仅提供文件监听→验证→codegen 流水线
 * - 真正的 HMR 由用户自己的 Vite/Webpack dev server 负责
 */

import { watch, type FSWatcher } from 'fs'
import { resolve, extname } from 'path'
import { readdirSync, statSync } from 'fs'
import { generateCode } from './codegen.js'
import { validateFiles } from './validate.js'

export interface DevServerOptions {
  port?: number
  host?: string
  open?: boolean
  /** 监听目录（默认当前目录） */
  watchDir?: string
  /** 输出目录 */
  output?: string
  /** Schema 文件后缀 */
  extensions?: string[]
}

interface ActiveServer {
  watchers: FSWatcher[]
  stop: () => void
}

const SCHEMA_EXTENSIONS = ['.json', '.schema.ts', '.schema.js']

/**
 * 递归收集目录下的 schema 文件路径
 */
function collectSchemaFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = []
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') continue
      const fullPath = resolve(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        files.push(...collectSchemaFiles(fullPath, extensions))
      } else if (extensions.some(ext => entry.endsWith(ext))) {
        files.push(fullPath)
      }
    }
  } catch {
    // 目录不存在或无权限，忽略
  }
  return files
}

/**
 * 启动 Vario 开发服务器
 *
 * 监听 schema 文件变化并自动验证 + 代码生成。
 */
export function startDevServer(options: DevServerOptions = {}): ActiveServer {
  const {
    watchDir = process.cwd(),
    output = './generated',
    extensions = SCHEMA_EXTENSIONS,
  } = options

  const absDir = resolve(watchDir)
  console.log(`[vario] Watching ${absDir} for schema changes...`)
  console.log(`[vario] Extensions: ${extensions.join(', ')}`)
  console.log(`[vario] Output: ${output}`)
  console.log()

  // 初始扫描
  const schemaFiles = collectSchemaFiles(absDir, extensions)
  if (schemaFiles.length > 0) {
    console.log(`[vario] Found ${schemaFiles.length} schema file(s):`)
    for (const f of schemaFiles) {
      console.log(`  - ${f}`)
    }
    // 初始验证
    const { valid } = validateFiles(schemaFiles)
    if (valid) {
      console.log('[vario] ✓ All schema files valid')
    }
  } else {
    console.log('[vario] No schema files found yet, watching for new files...')
  }
  console.log()

  // 防抖定时器
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const handleChange = (filename: string | null) => {
    if (!filename || !extensions.some(ext => filename.endsWith(ext))) return

    // 防抖：50ms 内只处理最后一次变更
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      console.log(`[vario] Change detected: ${filename}`)

      // 重新收集文件列表
      const currentFiles = collectSchemaFiles(absDir, extensions)
      const jsonFiles = currentFiles.filter(f => extname(f) === '.json')

      // 验证
      const { valid } = validateFiles(currentFiles)

      // 如果验证通过且有 JSON schema 文件，尝试代码生成
      if (valid && jsonFiles.length > 0) {
        for (const file of jsonFiles) {
          try {
            generateCode({ schema: file, output, root: absDir })
          } catch (err) {
            console.error(`[vario] Codegen failed for ${file}:`, err)
          }
        }
      }

      console.log()
    }, 50)
  }

  // 使用 Node.js 原生 fs.watch（递归模式在 macOS/Windows 上可用）
  const watchers: FSWatcher[] = []
  try {
    const watcher = watch(absDir, { recursive: true }, (_event, filename) => {
      handleChange(filename as string | null)
    })
    watchers.push(watcher)
  } catch {
    // 某些平台不支持 recursive，回退到逐目录监听
    console.warn('[vario] Recursive watch not supported, watching top-level only')
    const watcher = watch(absDir, (_event, filename) => {
      handleChange(filename as string | null)
    })
    watchers.push(watcher)
  }

  const stop = () => {
    for (const w of watchers) w.close()
    if (debounceTimer) clearTimeout(debounceTimer)
    console.log('[vario] Dev server stopped')
  }

  // 优雅退出
  process.on('SIGINT', () => { stop(); process.exit(0) })
  process.on('SIGTERM', () => { stop(); process.exit(0) })

  return { watchers, stop }
}