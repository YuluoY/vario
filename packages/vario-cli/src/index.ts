#!/usr/bin/env node
/**
 * Vario CLI Tools
 * 
 * Command-line interface for Vario development and build tools.
 */

import { Command } from 'commander'
import { startDevServer } from './dev-server.js'
import { generateCode } from './codegen.js'
import { validateFiles, prepareFiles, migrateFiles, inspectFiles } from './validate.js'

let lastExitCode = 0

const program = new Command()

program
  .name('vario')
  .description('Vario CLI - Development and build tools for Vario projects')
  .version(process.env.npm_package_version ?? '0.1.5')

program
  .command('dev')
  .description('Watch schema files and auto-validate/regenerate on change')
  .option('-d, --dir <dir>', 'Directory to watch', '.')
  .option('-o, --output <output>', 'Output directory for generated code', './generated')
  .action((options: { dir: string; output: string }) => {
    startDevServer({
      watchDir: options.dir,
      output: options.output
    })
  })

program
  .command('generate')
  .alias('gen')
  .description('Generate code from templates')
  .option('-t, --template <template>', 'Template name')
  .option('-o, --output <output>', 'Output directory', './generated')
  .option('--schema <schema>', 'Schema file path')
  .option('--root <dir>', 'Root directory for page-relative output paths')
  .action((options: { template?: string; output: string; schema?: string; root?: string }) => {
    generateCode({
      template: options.template,
      output: options.output,
      schema: options.schema,
      root: options.root
    })
  })

program
  .command('validate')
  .description('Validate Vario schema files')
  .argument('<files...>', 'Schema files to validate')
  .action((files: string[]) => {
    console.log(`Validating ${files.length} file(s)...`)
    const result = validateFiles(files)
    if (result.valid) {
      console.log(`\n✓ All ${files.length} file(s) valid`)
    } else {
      const failCount = result.fileResults.filter(r => !r.valid).length
      console.error(`\n✗ ${failCount} file(s) failed validation`)
      lastExitCode = 1
    }
  })

program
  .command('prepare')
  .alias('compile')
  .description('Prepare schema and print depth/budget diagnostics')
  .argument('<files...>', 'Schema files to prepare')
  .option('--profile <name>', 'performance profile name', 'default')
  .option('--max-depth <n>', 'max depth budget', '100')
  .action((files: string[], options: { profile?: string; maxDepth?: string }) => {
    const results = prepareFiles(files, {
      profile: options.profile,
      maxDepth: Number(options.maxDepth)
    })
    for (const row of results) {
      console.log(`prepare ${row.file} profile=${row.profile} nodes=${row.nodeCount} depth=${row.maxDepth} diagnostics=${row.diagnostics.length}`)
    }
    if (results.length === 0) lastExitCode = 1
  })

program
  .command('migrate')
  .description('Wrap legacy SchemaNode files as SchemaDocument v1')
  .argument('<files...>', 'Schema files to migrate')
  .action((files: string[]) => {
    const results = migrateFiles(files)
    for (const row of results) {
      console.log(`migrate ${row.file} schemaVersion=${row.schemaVersion} id=${row.id}`)
    }
    if (results.length === 0) lastExitCode = 1
  })

program
  .command('inspect')
  .description('Inspect schema documents and prepared view budgets')
  .argument('<files...>', 'Schema files to inspect')
  .action((files: string[]) => {
    const results = inspectFiles(files)
    for (const row of results) {
      console.log(`inspect ${row.file} id=${row.id} schemaVersion=${row.schemaVersion} nodes=${row.nodeCount} depth=${row.maxDepth} diagnostics=${row.diagnostics.length}`)
    }
    if (results.length === 0) lastExitCode = 1
  })

// 如果直接运行此文件，执行CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv)
}

export function runCli(argv: string[] = process.argv): number {
  lastExitCode = 0
  program.exitOverride()
  try {
    program.parse(argv)
    return lastExitCode
  } catch (error) {
    const err = error as { code?: string; exitCode?: number }
    if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
      return 0
    }
    if (typeof err.exitCode === 'number') return err.exitCode
    throw error
  }
}

export { program }
export * from './dev-server.js'
export * from './codegen.js'
export * from './validate.js'