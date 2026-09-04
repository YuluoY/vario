import { describe, expect, it, vi } from 'vitest'
import { runCli } from '../../../packages/vario-cli/src/index.js'

describe('consumer cli-bin', () => {
  it('RELEASE-4 --help/--version smoke', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    expect(runCli(['node', 'vario', '--help'])).toBe(0)
    expect(runCli(['node', 'vario', '--version'])).toBe(0)
    write.mockRestore()
    log.mockRestore()
  })
})
