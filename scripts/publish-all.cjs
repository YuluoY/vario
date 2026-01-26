'use strict'
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const inquirer = require('inquirer')
// chalk v5 is ESM; when required from CJS it may expose a { default } export.
const _chalk = require('chalk')
const chalk = _chalk && _chalk.default ? _chalk.default : _chalk

const packages = [
  'vario-core',
  'vario-schema',
  'vario-vue',
  'vario-cli'
]

const choices = [
  { name: chalk.yellow('全部发布 (all)'), value: 'all' },
  ...packages.map(p => ({ name: chalk.cyan(p), value: p }))
]

const versionTypes = [
  { name: chalk.green('补丁 (patch)'), value: 'patch' },
  { name: chalk.blue('新功能 (minor)'), value: 'minor' },
  { name: chalk.red('重大更新 (major)'), value: 'major' }
]

function bumpVersion(pkgPath, typeOrVersion) {
  const pkgFile = path.join(pkgPath, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
  const oldVersion = pkg.version

  // If caller passed an explicit semver string, use it directly
  if (/^\d+\.\d+\.\d+$/.test(typeOrVersion)) {
    const newVersion = typeOrVersion
    pkg.version = newVersion
    fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2))
    return { oldVersion, newVersion }
  }

  // Otherwise treat as bump type
  let [major, minor, patch] = oldVersion.split('.').map(Number)
  const type = typeOrVersion
  if (type === 'patch') patch += 1
  else if (type === 'minor') { minor += 1; patch = 0 }
  else if (type === 'major') { major += 1; minor = 0; patch = 0 }
  const newVersion = [major, minor, patch].join('.')
  pkg.version = newVersion
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2))
  return { oldVersion, newVersion }
}

function ensurePublishConfig(pkgPath) {
  const pkgFile = path.join(pkgPath, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
  let changed = false

  // Ensure scoped packages have public access
  if (pkg.name && pkg.name.startsWith('@') && (!pkg.publishConfig || !pkg.publishConfig.access)) {
    if (!pkg.publishConfig) {
      pkg.publishConfig = {}
    }
    pkg.publishConfig.access = 'public'
    changed = true
  }

  if (changed) {
    fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2))
  }
  return changed
}

async function main() {
  console.log(chalk.bold.bgMagenta('\nVario 多包发布工具\n'))

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: chalk.bold('请选择要发布的包（可多选，或选全部）：'),
      choices
    },
    {
      type: 'confirm',
      name: 'manualVersionMode',
      message: chalk.bold('是否手动输入版本号（适用于首次发布）？'),
      default: false
    },
    {
      type: 'input',
      name: 'manualVersion',
      message: chalk.bold('请输入版本号（semver，例如 1.0.0）：'),
      when: answers => answers.manualVersionMode,
      validate: input => /^\d+\.\d+\.\d+$/.test(input) || '请输入合法的 semver 版本号（例如 1.0.0）'
    },
    {
      type: 'list',
      name: 'versionType',
      message: chalk.bold('请选择版本号类型：'),
      choices: versionTypes,
      when: answers => !answers.manualVersionMode
    },
    {
      type: 'input',
      name: 'changelog',
      message: chalk.bold('请输入本次发包的更新内容（可选）：')
    },
    {
      type: 'input',
      name: 'otp',
      message: chalk.bold('若帐号开了 2FA，请输入 Authenticator 里的 6 位数字（仅 2FA 需要，用 token 发布请直接回车）：'),
      when: () => true
    }
  ])

  let toPublish = answers.selected
  if (toPublish.includes('all')) {
    toPublish = packages
  }

  // First pass: bump versions and collect version map
  const versionMap = {}
  for (const pkgName of toPublish) {
    const pkgPath = path.join(__dirname, '..', 'packages', pkgName)
    if (!fs.existsSync(pkgPath)) {
      console.log(chalk.bgRed.white(`包不存在: ${pkgName}`))
      continue
    }
    const bumpArg = answers.manualVersionMode ? answers.manualVersion : answers.versionType
    const { oldVersion, newVersion } = bumpVersion(pkgPath, bumpArg)
    versionMap[pkgName] = newVersion
  }

  // Second pass: ensure publishConfig only（不修改 dependencies，本地始终保持 workspace:*）
  for (const pkgName of toPublish) {
    const pkgPath = path.join(__dirname, '..', 'packages', pkgName)
    if (!fs.existsSync(pkgPath)) continue
    ensurePublishConfig(pkgPath)
  }

  const npmNameMap = {
    'vario-core': '@variojs/core',
    'vario-schema': '@variojs/schema',
    'vario-vue': '@variojs/vue',
    'vario-cli': '@variojs/cli'
  }
  function buildDepVersionMap() {
    const m = {}
    for (const [localName, npmName] of Object.entries(npmNameMap)) {
      if (versionMap[localName]) m[npmName] = versionMap[localName]
    }
    return m
  }

  // Check npm authentication before publishing
  // 指定 registry，避免代理或其它 registry 干扰；capture 输出以便判断
  console.log(chalk.yellow('\n检查 npm 认证状态...'))
  let authOk = false
  try {
    const out = execSync('npm whoami --registry=https://registry.npmjs.org', {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, npm_config_registry: 'https://registry.npmjs.org' }
    })
    const user = (out && String(out).trim()) || ''
    if (user && !/^\s*$/.test(user)) {
      console.log(chalk.green('✓ npm 已登录: ' + user))
      authOk = true
    }
  } catch (e) {
    const err = [e.stderr, e.stdout, e.message].filter(Boolean).join(' ')
    if (/E401|E403|Unauthorized|token|credentials/i.test(err)) {
      console.log(chalk.yellow('⚠ whoami 报错但疑似已配置 token，将继续尝试发布'))
      authOk = true
    }
  }
  if (!authOk) {
    const skipAnswer = await inquirer.prompt([{
      type: 'confirm',
      name: 'skip',
      message: chalk.yellow('未能确认 npm 登录。若已配置 token，可继续发布。是否继续？'),
      default: true
    }])
    if (!skipAnswer.skip) process.exit(1)
  }

  // Third pass: publish（发布前临时把 workspace:* 换成 ^version，发布后恢复）
  const depVersionMap = buildDepVersionMap()
  for (const pkgName of toPublish) {
    const pkgPath = path.join(__dirname, '..', 'packages', pkgName)
    if (!fs.existsSync(pkgPath)) continue
    const pkgFile = path.join(pkgPath, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
    const newVersion = pkg.version

    const originalDeps = pkg.dependencies ? { ...pkg.dependencies } : undefined
    if (pkg.dependencies) {
      for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
        if (depVersion === 'workspace:*' && depVersionMap[depName]) {
          pkg.dependencies[depName] = `^${depVersionMap[depName]}`
        }
      }
      fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2))
    }

    const restoreDeps = () => {
      if (originalDeps) {
        pkg.dependencies = originalDeps
        fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2))
      }
    }

    console.log(chalk.bold(`\n------------------------------`))
    console.log(chalk.bold(`【${chalk.cyan(pkgName)}】`))
    console.log(`${chalk.gray('版本:')} ${chalk.green(newVersion)}`)
    if (answers.changelog) {
      console.log(chalk.gray('更新内容: ') + chalk.white(answers.changelog))
    }

    try {
      // Check if dist exists
      const distPath = path.join(pkgPath, 'dist')
      if (!fs.existsSync(distPath)) {
        console.log(chalk.yellow('⚠️  构建产物不存在，正在构建...'))
        try {
          execSync('pnpm build', { cwd: pkgPath, stdio: 'inherit' })
        } catch (e) {
          console.log(chalk.bgRed.white(`构建失败: ${pkgName}`))
          continue
        }
      }

      // Ensure bin file has shebang for ESM modules
      if (pkg.bin) {
        for (const [binName, binPath] of Object.entries(pkg.bin)) {
          const fullBinPath = path.join(pkgPath, binPath)
          if (fs.existsSync(fullBinPath)) {
            const content = fs.readFileSync(fullBinPath, 'utf8')
            if (!content.startsWith('#!/usr/bin/env node')) {
              fs.writeFileSync(fullBinPath, '#!/usr/bin/env node\n' + content)
              try {
                fs.chmodSync(fullBinPath, '755')
              } catch (e) {}
            }
          }
        }
      }

      console.log(chalk.magenta('开始发布...'))
      // Use --access public for scoped packages to ensure they're published as public
      let publishCmd = pkg.name && pkg.name.startsWith('@') 
        ? 'npm publish --access public' 
        : 'npm publish'
      
      // Add OTP if provided (must look like 6-digit code, not token)
      const otpInput = answers.otp && answers.otp.trim()
      if (otpInput) {
        if (/^npm_/.test(otpInput) || otpInput.length > 20) {
          console.log(chalk.yellow('⚠ 当前输入像 token 而非 OTP，已忽略。Token 请用: npm config set //registry.npmjs.org/:_authToken <TOKEN>'))
        } else {
          publishCmd += ` --otp=${otpInput}`
        }
      }
      
      const output = execSync(publishCmd, { 
        cwd: pkgPath, 
        stdio: 'pipe',
        encoding: 'utf8'
      })
      if (output) console.log(chalk.gray(output))
      console.log(chalk.bgGreen.black(`✓ 发布成功: ${pkg.name}@${newVersion}`))
    } catch (e) {
      console.log(chalk.bgRed.white(`✗ 发布失败: ${pkgName}`))
      
      // Combine stdout and stderr for error detection
      const stdout = e.stdout ? e.stdout.toString() : ''
      const stderr = e.stderr ? e.stderr.toString() : ''
      const errorOutput = stdout + stderr
      
      // Check for specific error types
      if (errorOutput.includes('403') && (errorOutput.includes('Two-factor authentication') || errorOutput.includes('Forbidden'))) {
        console.log(chalk.red('\n认证错误：需要 2FA 或 granular access token'))
        console.log(chalk.yellow('\n解决方案：'))
        console.log(chalk.cyan('1. 在 npm 账户设置中启用 2FA'))
        console.log(chalk.cyan('2. 或创建 granular access token (需要 "bypass 2fa" 权限)'))
        console.log(chalk.cyan('   访问: https://www.npmjs.com/settings/<username>/tokens'))
        console.log(chalk.cyan('   使用 token: npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN'))
      } else if (errorOutput.includes('404') && errorOutput.includes('Not found')) {
        // 404 could mean package doesn't exist (first publish) or permission issue
        if (errorOutput.includes('Access token expired') || errorOutput.includes('permission')) {
          console.log(chalk.red('\n权限错误：可能是 token 权限不足或已过期'))
          console.log(chalk.yellow('请检查：'))
          console.log(chalk.cyan('1. Token 是否有 "publish" 权限'))
          console.log(chalk.cyan('2. Token 是否已过期'))
          console.log(chalk.cyan('3. 对于首次发布的 scoped package，确保 token 有创建包的权限'))
        } else {
          console.log(chalk.yellow('\n首次发布：包不存在，这可能是正常的'))
          console.log(chalk.yellow('但如果持续失败，请检查 token 权限'))
        }
        console.log(chalk.red('\n完整错误信息：'))
        if (stdout) console.log(chalk.gray('STDOUT:', stdout))
        if (stderr) console.log(chalk.gray('STDERR:', stderr))
      } else if (errorOutput.includes('EOTP') || errorOutput.includes('one-time password')) {
        console.log(chalk.red('\n需要 2FA 一次性密码（OTP）'))
        console.log(chalk.yellow('\n解决方案：'))
        console.log(chalk.cyan('1. 在发布脚本中输入 OTP（如果已提供则可能已过期，请重新运行）'))
        console.log(chalk.cyan('2. 或创建 Granular Access Token 并勾选 "bypass 2FA"'))
        console.log(chalk.cyan('   访问: https://www.npmjs.com/settings/yuluoiii/tokens'))
        if (stdout) console.log(chalk.gray('\nSTDOUT:', stdout))
        if (stderr) console.log(chalk.gray('STDERR:', stderr))
      } else if (errorOutput.includes('Access token expired') || errorOutput.includes('revoked')) {
        console.log(chalk.red('\n认证 token 已过期或已撤销'))
        console.log(chalk.yellow('请重新生成 token 并配置：'))
        console.log(chalk.cyan('npm config set //registry.npmjs.org/:_authToken YOUR_NEW_TOKEN'))
        if (stdout) console.log(chalk.gray('\nSTDOUT:', stdout))
        if (stderr) console.log(chalk.gray('STDERR:', stderr))
      } else {
        // Show full error output
        if (stdout) console.log(chalk.red('STDOUT:', stdout))
        if (stderr) console.log(chalk.red('STDERR:', stderr))
        if (e.message && !errorOutput.includes(e.message)) console.log(chalk.red('ERROR:', e.message))
      }
    }
    finally {
      restoreDeps()
    }
    console.log(chalk.bold(`------------------------------\n`))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
