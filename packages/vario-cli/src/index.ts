#!/usr/bin/env node
/**
 * Vario CLI Tools
 * 
 * Command-line interface for Vario development and build tools.
 */

import { Command } from 'commander'
import { startDevServer } from './dev-server.js'
import { generateCode } from './codegen.js'

const program = new Command()

program
  .name('vario')
  .description('Vario CLI - Development and build tools for Vario projects')
  .version('0.1.0')

program
  .command('dev')
  .description('Start development server with HMR')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('-h, --host <host>', 'Host address', 'localhost')
  .option('--open', 'Open browser automatically', false)
  .action((options: { port: string; host: string; open: boolean }) => {
    startDevServer({
      port: parseInt(options.port),
      host: options.host,
      open: options.open
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
  .command('build')
  .description('Build Vario project for production')
  .option('-o, --output <output>', 'Output directory', './dist')
  .option('--minify', 'Minify output', true)
  .action((options: { output: string; minify: boolean }) => {
    console.log('Build command - Not yet implemented')
    console.log('Options:', options)
  })

program
  .command('validate')
  .description('Validate Vario schema files')
  .argument('<files...>', 'Schema files to validate')
  .option('--strict', 'Enable strict validation', false)
  .action((files: string[], options: { strict: boolean }) => {
    console.log('Validate command - Not yet implemented')
    console.log('Files:', files)
    console.log('Options:', options)
  })

// 如果直接运行此文件，执行CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse()
}

export { program }
export * from './dev-server.js'
export * from './codegen.js'