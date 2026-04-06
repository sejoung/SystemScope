import { execFile } from 'node:child_process'
import * as path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const SHELL_PATH_SENTINEL_START = '__SYSTEMSCOPE_PATH_START__'
const SHELL_PATH_SENTINEL_END = '__SYSTEMSCOPE_PATH_END__'

let loginShellPathEntriesPromise: Promise<string[]> | null = null

export type ExternalCommandFailureKind =
  | 'command_not_found'
  | 'permission_denied'
  | 'timeout'
  | 'execution_failed'

export class ExternalCommandError extends Error {
  readonly command: string
  readonly args: string[]
  readonly kind: ExternalCommandFailureKind
  readonly code?: string
  readonly stdout: string
  readonly stderr: string
  readonly cause?: unknown

  constructor(params: {
    command: string
    args: string[]
    kind: ExternalCommandFailureKind
    code?: string
    stdout?: string
    stderr?: string
    cause?: unknown
    message?: string
  }) {
    super(params.message ?? `External command failed: ${params.command}`)
    this.name = 'ExternalCommandError'
    this.command = params.command
    this.args = params.args
    this.kind = params.kind
    this.code = params.code
    this.stdout = params.stdout ?? ''
    this.stderr = params.stderr ?? ''
    this.cause = params.cause
  }
}

export async function runExternalCommand(
  command: string,
  args: string[],
  options?: Parameters<typeof execFileAsync>[2]
): Promise<{ stdout: string; stderr: string }> {
  try {
    const execOptions = await withResolvedCommandEnv(options)
    const result = await execFileAsync(command, args, execOptions)
    return {
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? '')
    }
  } catch (error) {
    throw toExternalCommandError(command, args, error)
  }
}

export function isExternalCommandError(error: unknown): error is ExternalCommandError {
  return error instanceof ExternalCommandError
}

async function withResolvedCommandEnv(
  options?: Parameters<typeof execFileAsync>[2]
): Promise<Parameters<typeof execFileAsync>[2]> {
  const env = await buildCommandEnv(options?.env)
  if (!env) {
    return options
  }

  return {
    ...options,
    env,
  }
}

async function buildCommandEnv(overrides?: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv | undefined> {
  const mergedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...(overrides ?? {}),
  }
  const resolvedPath = await buildResolvedPath(mergedEnv.PATH)

  if (!resolvedPath) {
    return Object.keys(mergedEnv).length > 0 ? mergedEnv : undefined
  }

  mergedEnv.PATH = resolvedPath
  return mergedEnv
}

async function buildResolvedPath(currentPath?: string): Promise<string> {
  const currentEntries = splitPathEntries(currentPath)
  const loginShellEntries = await getLoginShellPathEntries()
  const candidateEntries = [
    ...currentEntries,
    ...loginShellEntries,
    ...getCommonExecutablePaths(),
  ]

  return Array.from(new Set(candidateEntries)).join(path.delimiter)
}

function splitPathEntries(value?: string): string[] {
  if (!value) {
    return []
  }

  return value
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

async function getLoginShellPathEntries(): Promise<string[]> {
  if (process.platform === 'win32') {
    return []
  }

  loginShellPathEntriesPromise ??= loadLoginShellPathEntries()
  return loginShellPathEntriesPromise
}

async function loadLoginShellPathEntries(): Promise<string[]> {
  const shell = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')

  try {
    const { stdout } = await execFileAsync(
      shell,
      ['-ilc', `printf '${SHELL_PATH_SENTINEL_START}%s${SHELL_PATH_SENTINEL_END}' "$PATH"`],
      {
        env: {
          ...process.env,
          TERM: 'dumb',
        },
        timeout: 2000,
        maxBuffer: 64 * 1024,
      },
    )

    const output = String(stdout ?? '')
    const start = output.lastIndexOf(SHELL_PATH_SENTINEL_START)
    const end = output.indexOf(SHELL_PATH_SENTINEL_END, start + SHELL_PATH_SENTINEL_START.length)
    if (start === -1 || end === -1) {
      return []
    }

    return splitPathEntries(output.slice(start + SHELL_PATH_SENTINEL_START.length, end))
  } catch {
    return []
  }
}

function getCommonExecutablePaths(): string[] {
  if (process.platform === 'darwin') {
    return [
      '/usr/local/bin',
      '/usr/local/sbin',
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/Applications/Docker.app/Contents/Resources/bin',
      `${process.env.HOME ?? ''}/.docker/bin`,
    ].filter(Boolean)
  }

  if (process.platform === 'win32') {
    return []
  }

  return ['/usr/local/bin', '/usr/local/sbin', '/usr/bin', '/usr/sbin', '/snap/bin']
}

function toExternalCommandError(command: string, args: string[], error: unknown): ExternalCommandError {
  const err = error as {
    code?: string
    message?: string
    stdout?: string
    stderr?: string
    killed?: boolean
    signal?: NodeJS.Signals | null
  }

  const stdout = err.stdout ?? ''
  const stderr = err.stderr ?? ''
  const code = typeof err.code === 'string' ? err.code : undefined
  const message = err.message ?? `${command} failed`
  const lowerText = `${message}\n${stderr}`.toLowerCase()

  let kind: ExternalCommandFailureKind = 'execution_failed'
  if (code === 'ENOENT' || lowerText.includes('not found') || lowerText.includes('is not recognized')) {
    kind = 'command_not_found'
  } else if (code === 'EACCES' || code === 'EPERM' || lowerText.includes('permission denied') || lowerText.includes('operation not permitted')) {
    kind = 'permission_denied'
  } else if (code === 'ETIMEDOUT' || err.killed === true || err.signal === 'SIGTERM') {
    kind = 'timeout'
  }

  return new ExternalCommandError({
    command,
    args,
    kind,
    code,
    stdout,
    stderr,
    cause: error,
    message
  })
}
