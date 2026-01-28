#!/usr/bin/env node
/**
 * 压缩 dist 目录下的所有 .js 文件
 * 使用 esbuild 进行代码压缩和混淆
 */
import { transform } from 'esbuild'
import { readdir, readFile, writeFile } from 'fs/promises'
import { join, relative } from 'path'

async function findJSFiles(dir) {
  const files = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...await findJSFiles(fullPath))
      } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.min.js')) {
        files.push(fullPath)
      }
    }
  } catch (err) {
    // 忽略不存在的目录
  }
  return files
}

async function minifyFile(filePath) {
  const relativePath = relative(process.cwd(), filePath)
  try {
    const code = await readFile(filePath, 'utf-8')
    // 保留 shebang（如果有）
    const shebangMatch = code.match(/^#!.*\n/)
    const hasShebang = !!shebangMatch
    const codeWithoutShebang = hasShebang ? code.slice(shebangMatch[0].length) : code
    
    const result = await transform(codeWithoutShebang, {
      minify: true,
      format: 'esm',
      target: 'es2022',
      legalComments: 'none' // 移除所有注释
    })
    
    const finalCode = hasShebang ? shebangMatch[0] + result.code : result.code
    await writeFile(filePath, finalCode, 'utf-8')
    console.log(`✓ 压缩: ${relativePath}`)
  } catch (err) {
    console.error(`✗ 压缩失败: ${relativePath}`, err.message)
  }
}

async function main() {
  const distDir = join(process.cwd(), 'dist')
  const jsFiles = await findJSFiles(distDir)
  
  if (jsFiles.length === 0) {
    console.log('未找到 .js 文件')
    return
  }
  
  console.log(`找到 ${jsFiles.length} 个文件，开始压缩...`)
  for (const file of jsFiles) {
    await minifyFile(file)
  }
  console.log('压缩完成')
}

main().catch(console.error)
