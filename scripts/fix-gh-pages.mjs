#!/usr/bin/env node

import { copyFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// 如果从 play 目录调用，__dirname 是 scripts，需要回到项目根目录
// 如果从项目根目录调用，__dirname 就是 scripts
const rootDir = __dirname.includes('play/scripts') 
  ? join(__dirname, '../..')
  : join(__dirname, '..')
const distDir = join(rootDir, 'play/dist')
const indexHtml = join(distDir, 'index.html')
const notFoundHtml = join(distDir, '404.html')

// 复制 index.html 到 404.html，解决 GitHub Pages SPA 路由刷新 404 问题
if (existsSync(indexHtml)) {
  copyFileSync(indexHtml, notFoundHtml)
  console.log('✅ Created 404.html for GitHub Pages SPA routing')
} else {
  console.warn('⚠️  index.html not found, skipping 404.html creation')
  process.exit(1)
}
