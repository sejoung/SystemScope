import { describe, expect, it } from 'vitest'
import { ExternalCommandError } from '../../src/main/services/externalCommand'

describe('ExternalCommandError', () => {
  it('should classify command-not-found errors', () => {
    const error = new ExternalCommandError({
      command: 'docker',
      args: ['ps'],
      kind: 'command_not_found',
      code: 'ENOENT',
      message: 'spawn docker ENOENT'
    })

    expect(error.kind).toBe('command_not_found')
    expect(error.code).toBe('ENOENT')
  })

  it('should retain stdout and stderr for graceful fallbacks', () => {
    const error = new ExternalCommandError({
      command: 'du',
      args: ['-sk', '/tmp/example'],
      kind: 'execution_failed',
      stdout: '123\t/tmp/example\n',
      stderr: 'du: permission denied'
    })

    expect(error.stdout).toContain('/tmp/example')
    expect(error.stderr).toContain('permission denied')
  })
})
