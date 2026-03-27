import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

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
    const result = await execFileAsync(command, args, options)
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
