#!/usr/bin/env node

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import chalk from 'chalk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// 检查 packages 是否已构建
function checkPackagesBuilt() {
  const coreDist = join(rootDir, 'packages/vario-core/dist/index.js')
  return existsSync(coreDist)
}

// 构建 packages
async function buildPackages() {
  console.log(chalk.blue('📦 Building packages...'))
  return new Promise((resolve, reject) => {
    const build = spawn('pnpm', ['build'], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false
    })
    
    build.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('✅ Packages built successfully\n'))
        resolve()
      } else {
        reject(new Error(`Build failed with code ${code}`))
      }
    })
    
    build.on('error', reject)
  })
}

// 启动开发服务器
function startDevServers() {
  console.log(chalk.cyan('🚀 Starting development servers...'))
  console.log(chalk.gray('   Play: http://localhost:5173'))
  console.log(chalk.gray('   Docs: http://localhost:5174\n'))
  
  // 使用 concurrently 同时启动两个服务
  const command = `npx concurrently -n play,docs -c blue,green "pnpm --filter './play' dev" "pnpm --filter './docs' dev"`
  
  const proc = spawn(command, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true
  })
  
  proc.on('error', (err) => {
    console.error(chalk.red('❌ Failed to start servers:'), err.message)
    process.exit(1)
  })
  
  // 处理退出信号
  const cleanup = () => {
    console.log(chalk.yellow('\n🛑 Stopping servers...'))
    proc.kill('SIGTERM')
    process.exit(0)
  }
  
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

// 主函数
async function main() {
  const args = process.argv.slice(2)
  const skipBuild = args.includes('--skip-build') || args.includes('-s')
  
  try {
    if (!skipBuild && !checkPackagesBuilt()) {
      await buildPackages()
    } else if (skipBuild) {
      console.log(chalk.yellow('⏭️  Skipping build\n'))
    } else {
      console.log(chalk.green('✅ Packages already built\n'))
    }
    
    startDevServers()
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message)
    process.exit(1)
  }
}

main()
