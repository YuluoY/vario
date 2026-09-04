#!/usr/bin/env node
import { runCli } from '../dist/index.js'

const code = runCli(process.argv)
if (code) process.exit(code)
