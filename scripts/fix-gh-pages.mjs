#!/usr/bin/env node

import { copyFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
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
