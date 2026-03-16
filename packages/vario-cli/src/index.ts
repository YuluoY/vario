#!/usr/bin/env node
/**
 * Vario CLI Tools
 * 
 * Command-line interface for Vario development and build tools.
 */

import { Command } from 'commander'
import { startDevServer } from './dev-server.js'
import { generateCode } from './codegen.js'
import { validateFiles } from './validate.js'

const program = new Command()

program
  .name('vario')
  .description('Vario CLI - Development and build tools for Vario projects')
  .version('0.1.0')

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
  .action((options: { template?: string; output: string; schema?: string }) => {
    generateCode({
      template: options.template,
      output: options.output,
      schema: options.schema
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
      process.exit(1)
    }
  })

// 如果直接运行此文件，执行CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse()
}

export { program }
export * from './dev-server.js'
export * from './codegen.js'
export * from './validate.js'