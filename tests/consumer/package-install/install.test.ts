import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('consumer package-install manifests', () => {
  it('Vue peer and package files stay publish-ready', () => {
    const root = resolve(__dirname, '../../..')
    const vuePkg = JSON.parse(readFileSync(resolve(root, 'packages/vario-vue/package.json'), 'utf8')) as {
      peerDependencies: { vue: string }
      files: string[]
    }
    expect(vuePkg.peerDependencies.vue).toBe('^3.4.0')
    expect(vuePkg.files).toContain('dist')
  })
})
