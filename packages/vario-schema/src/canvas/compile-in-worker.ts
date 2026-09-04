import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import type { SchemaNode } from '@variojs/types'

export type WorkerCompileResult = {
  nodeCount: number
  maxDepth: number
  workerMs: number
  mainThreadBusyMs: number
}

function repoRootFromHere(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../')
}

async function bundleWorker(): Promise<string> {
  const { createRequire } = await import('node:module')
  const root = repoRootFromHere()
  const require = createRequire(join(root, 'package.json'))
  const esbuild = require('esbuild') as typeof import('esbuild')
  const outfile = join(tmpdir(), 'vario-schema-compile-worker.mjs')
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: [fileURLToPath(new URL('./compile-worker-entry.ts', import.meta.url))],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    alias: {
      '@variojs/types': join(root, 'packages/vario-types/src/index.ts'),
      '@variojs/core': join(root, 'packages/vario-core/src/index.ts')
    }
  })
  return outfile
}

export async function compileSchemaInWorker(schema: SchemaNode): Promise<WorkerCompileResult> {
  const serializeStart = performance.now()
  const payload = JSON.parse(JSON.stringify(schema)) as SchemaNode
  const mainThreadBusyMs = performance.now() - serializeStart
  const workerFile = await bundleWorker()
  return await new Promise((resolve, reject) => {
    const worker = new Worker(workerFile, { type: 'module' } as never)
    worker.once('message', (result: Omit<WorkerCompileResult, 'mainThreadBusyMs'>) => {
      worker.terminate()
      resolve({ ...result, mainThreadBusyMs })
    })
    worker.once('error', (error) => {
      worker.terminate()
      reject(error)
    })
    worker.postMessage(payload)
  })
}
