import { parentPort } from 'node:worker_threads'
import { prepareView } from '../compiler/prepare-view.js'
import { validateSchema } from '../validator.js'

parentPort?.on('message', (schema) => {
  const started = Date.now()
  validateSchema(schema, { maxDepth: 10_000 })
  const view = prepareView(schema)
  parentPort?.postMessage({
    nodeCount: view.nodeCount,
    maxDepth: view.maxDepth,
    workerMs: Date.now() - started
  })
})
