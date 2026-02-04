#!/usr/bin/env node
/**
 * 构建脚本 - 处理循环依赖的智能构建
 * 
 * 策略：
 * 1. 第一轮：所有包只构建 JS，不生成 DTS
 * 2. 第二轮：所有包生成 DTS（此时所有 JS 和类型都已存在）
 */
import { spawn } from 'child_process'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import chalk from 'chalk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// 定义所有包及其依赖关系
const packages = [
  { name: '@variojs/types', dir: 'packages/vario-types', hasDts: true, dependsOn: [] },
  { name: '@variojs/schema', dir: 'packages/vario-schema', hasDts: true, dependsOn: ['@variojs/types', '@variojs/core'] },
  { name: '@variojs/core', dir: 'packages/vario-core', hasDts: true, dependsOn: ['@variojs/types', '@variojs/schema'] },
  { name: '@variojs/vue', dir: 'packages/vario-vue', hasDts: true, dependsOn: ['@variojs/types', '@variojs/core', '@variojs/schema'] },
  { name: '@variojs/cli', dir: 'packages/vario-cli', hasDts: true, dependsOn: [] }
]

// DTS 生成顺序（现在没有循环依赖了）
const dtsOrder = ['@variojs/types', '@variojs/core', '@variojs/schema', '@variojs/vue', '@variojs/cli']

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(chalk.cyan(`\n▶ 执行: ${command} ${args.join(' ')}`))
    console.log(chalk.gray(`  目录: ${cwd}\n`))
    
    const proc = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`命令失败，退出码: ${code}`))
      }
    })

    proc.on('error', reject)
  })
}

async function cleanDist(pkg) {
  const pkgDir = join(rootDir, pkg.dir)
  
  console.log(chalk.yellow(`🧹 清理 ${pkg.name} 的 dist 目录...`))
  
  try {
    await runCommand('rm', ['-rf', 'dist'], pkgDir)
    console.log(chalk.green(`✓ ${pkg.name} 清理完成`))
  } catch (err) {
    console.log(chalk.gray(`  ${pkg.name} 无需清理`))
  }
}

async function buildJsOnly(pkg) {
  const pkgDir = join(rootDir, pkg.dir)
  
  console.log(chalk.blue(`📦 构建 ${pkg.name} (JS only)...`))
  
  try {
    // 使用环境变量告诉 tsup 跳过 DTS
    await runCommand('pnpm', ['exec', 'tsup', '--no-dts'], pkgDir)
    console.log(chalk.green(`✓ ${pkg.name} JS 构建成功`))
  } catch (err) {
    console.error(chalk.red(`✗ ${pkg.name} JS 构建失败`))
    throw err
  }
}

async function buildDtsOnly(pkg) {
  const pkgDir = join(rootDir, pkg.dir)
  
  console.log(chalk.blue(`📝 生成 ${pkg.name} 类型定义...`))
  
  try {
    // 只生成 DTS
    await runCommand('pnpm', ['exec', 'tsup', '--dts-only'], pkgDir)
    console.log(chalk.green(`✓ ${pkg.name} DTS 生成成功`))
  } catch (err) {
    console.error(chalk.red(`✗ ${pkg.name} DTS 生成失败`))
    throw err
  }
}

async function main() {
  const args = process.argv.slice(2)
  const cleanOnly = args.includes('--clean')

  console.log(chalk.bold.cyan('\n🚀 Vario 智能构建脚本\n'))
  console.log(chalk.gray('=' .repeat(50)))

  if (cleanOnly) {
    console.log(chalk.yellow('\n清理所有包的 dist 目录...\n'))
    for (const pkg of packages) {
      await cleanDist(pkg)
    }
    console.log(chalk.green.bold('\n✓ 清理完成！\n'))
    return
  }

  const startTime = Date.now()

  try {
    // 第一步：清理所有包
    console.log(chalk.bold('\n第一步：清理所有包\n'))
    for (const pkg of packages) {
      await cleanDist(pkg)
    }

    // 第二步：构建所有 JS（不生成 DTS）
    console.log(chalk.bold('\n第二步：构建所有 JS 文件\n'))
    for (const pkg of packages) {
      await buildJsOnly(pkg)
    }

    // 第三步：按正确顺序生成 DTS（打破循环依赖）
    console.log(chalk.bold('\n第三步：生成所有类型定义\n'))
    for (const pkgName of dtsOrder) {
      const pkg = packages.find(p => p.name === pkgName)
      if (pkg && pkg.hasDts) {
        await buildDtsOnly(pkg)
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(chalk.green.bold(`\n✓ 所有包构建成功！`))
    console.log(chalk.gray(`  耗时: ${duration}s\n`))
  } catch (err) {
    console.error(chalk.red.bold('\n✗ 构建失败！\n'))
    console.error(chalk.red(err.message))
    process.exit(1)
  }
}

main().catch(err => {
  console.error(chalk.red(err.message))
  process.exit(1)
})
