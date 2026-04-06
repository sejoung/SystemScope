import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExternalCommandError } from '../../src/main/services/externalCommand'

const execFileMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}))

describe('ExternalCommandError', () => {
  beforeEach(() => {
    vi.resetModules()
    execFileMock.mockReset()
  })

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

  it('should augment PATH with login shell and common executable paths', async () => {
    vi.stubEnv('SHELL', '/bin/zsh')
    vi.stubEnv('PATH', '/usr/bin')
    const loginShellPath = process.platform === 'darwin'
      ? '/Users/test/.nvm/versions/node/v24.0.0/bin:/opt/homebrew/bin'
      : '/home/test/.nvm/versions/node/v24.0.0/bin:/usr/local/bin'

    execFileMock
      .mockImplementationOnce((_command: string, _args: string[], _options: Record<string, unknown>, callback: (error: Error | null, stdout?: string, stderr?: string) => void) => {
        callback(null, `__SYSTEMSCOPE_PATH_START__${loginShellPath}__SYSTEMSCOPE_PATH_END__`, '')
        return {} as never
      })
      .mockImplementationOnce((_command: string, _args: string[], options: Record<string, unknown>, callback: (error: Error | null, stdout?: string, stderr?: string) => void) => {
        const env = options.env as NodeJS.ProcessEnv
        expect(env.PATH).toContain('/usr/bin')
        expect(env.PATH).toContain(process.platform === 'darwin' ? '/opt/homebrew/bin' : '/usr/local/bin')
        if (process.platform === 'darwin') {
          expect(env.PATH).toContain('/Applications/Docker.app/Contents/Resources/bin')
        } else {
          expect(env.PATH).toContain('/usr/sbin')
        }
        callback(null, 'v24.0.0', '')
        return {} as never
      })

    const { runExternalCommand } = await import('../../src/main/services/externalCommand')
    await runExternalCommand('node', ['--version'])
    expect(execFileMock).toHaveBeenCalledTimes(2)
    expect(execFileMock.mock.calls[0]?.[0]).toBe('/bin/zsh')
    expect(execFileMock.mock.calls[1]?.[0]).toBe('node')
  })

  it('should respect explicit PATH overrides while still merging resolved entries', async () => {
    vi.stubEnv('SHELL', '/bin/zsh')

    execFileMock
      .mockImplementationOnce((_command: string, _args: string[], _options: Record<string, unknown>, callback: (error: Error | null, stdout?: string, stderr?: string) => void) => {
        callback(null, '__SYSTEMSCOPE_PATH_START__/custom/shell/bin__SYSTEMSCOPE_PATH_END__', '')
        return {} as never
      })
      .mockImplementationOnce((_command: string, _args: string[], options: Record<string, unknown>, callback: (error: Error | null, stdout?: string, stderr?: string) => void) => {
        const env = options.env as NodeJS.ProcessEnv
        expect(env.PATH).toContain('/override/bin')
        callback(null, '1.0.0', '')
        return {} as never
      })

    const { runExternalCommand } = await import('../../src/main/services/externalCommand')
    await runExternalCommand('pnpm', ['--version'], {
      env: {
        PATH: '/override/bin',
      },
    })

    expect(execFileMock).toHaveBeenCalledTimes(2)
    expect(execFileMock.mock.calls[1]?.[0]).toBe('pnpm')
  })
})
