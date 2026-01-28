#!/usr/bin/env node

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import chalk from 'chalk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// 执行命令并返回 Promise
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
      ...options
    })
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with code ${code}`))
      }
    })
    
    proc.on('error', reject)
  })
}

// 主函数
async function main() {
  try {
    console.log(chalk.blue('🧪 Running tests for all packages...'))
    await runCommand('pnpm', ['--filter', './packages/*', 'test'])
    console.log(chalk.green('✅ All tests passed\n'))
    
    console.log(chalk.blue('📦 Building all packages...'))
    await runCommand('pnpm', ['--filter', './packages/*', 'build'])
    console.log(chalk.green('✅ All packages built successfully\n'))
    
    console.log(chalk.blue('🏗️  Building play site...'))
    await runCommand('pnpm', ['--filter', './play', 'build'])
    console.log(chalk.green('✅ Play site built successfully\n'))
    
    console.log(chalk.green('✨ Pre-commit checks passed!'))
  } catch (error) {
    console.error(chalk.red('❌ Pre-commit checks failed:'), error.message)
    console.error(chalk.yellow('\nPlease fix the errors before committing.'))
    process.exit(1)
  }
}

main()
