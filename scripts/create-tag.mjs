#!/usr/bin/env node

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import chalk from 'chalk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// 从 package.json 读取版本
function getVersion() {
  const pkgPath = join(rootDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  return pkg.version
}

// 检查 tag 是否已存在
function tagExists(tag) {
  try {
    execSync(`git rev-parse ${tag}`, { stdio: 'ignore', cwd: rootDir })
    return true
  } catch {
    return false
  }
}

// 获取最新的 commit hash
function getLatestCommit() {
  return execSync('git rev-parse HEAD', { encoding: 'utf8', cwd: rootDir }).trim()
}

// 主函数
function main() {
  const args = process.argv.slice(2)
  const version = args[0] || getVersion()
  const tag = `v${version}`
  const push = args.includes('--push') || args.includes('-p')
  
  try {
    // 检查 tag 是否已存在
    if (tagExists(tag)) {
      console.log(chalk.yellow(`⚠️  Tag ${tag} already exists`))
      const overwrite = args.includes('--force') || args.includes('-f')
      if (!overwrite) {
        console.log(chalk.yellow('Use --force to overwrite'))
        process.exit(1)
      }
      console.log(chalk.yellow(`🗑️  Deleting existing tag ${tag}...`))
      execSync(`git tag -d ${tag}`, { stdio: 'inherit', cwd: rootDir })
    }
    
    // 创建 tag
    const commit = getLatestCommit()
    console.log(chalk.blue(`🏷️  Creating tag ${tag} at commit ${commit.substring(0, 7)}...`))
    execSync(`git tag -a ${tag} -m "Release ${tag}"`, { stdio: 'inherit', cwd: rootDir })
    console.log(chalk.green(`✅ Tag ${tag} created successfully`))
    
    // 推送到远程
    if (push) {
      console.log(chalk.blue(`📤 Pushing tag ${tag} to remote...`))
      execSync(`git push origin ${tag}`, { stdio: 'inherit', cwd: rootDir })
      if (args.includes('--force') || args.includes('-f')) {
        execSync(`git push origin ${tag} --force`, { stdio: 'inherit', cwd: rootDir })
      } else {
        execSync(`git push origin ${tag}`, { stdio: 'inherit', cwd: rootDir })
      }
      console.log(chalk.green(`✅ Tag ${tag} pushed to remote`))
    } else {
      console.log(chalk.yellow(`💡 Use --push to push tag to remote`))
    }
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message)
    process.exit(1)
  }
}

main()
