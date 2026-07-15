import path from 'node:path'
import { logWarn } from '@main/services/core/logging'
import { tk } from '../../i18n'
import { isExternalCommandError, runExternalCommand } from '@main/services/core/externalCommand'

let hasLoggedDockerLookupDiagnostics = false
const DOCKER_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.:\-/]*$/

export function validateDockerId(id: string): boolean {
  return DOCKER_ID_PATTERN.test(id)
}

export async function runDockerJsonLines<T>(args: string[]): Promise<
  | { status: 'ready'; rows: T[]; message: null }
  | { status: 'not_installed' | 'daemon_unavailable'; rows: T[]; message: string }
> {
  try {
    const { stdout } = await runDockerCommand(args)
    const rows: T[] = []
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        rows.push(JSON.parse(trimmed) as T)
      } catch {
        // Docker 출력에서 잘못된 형식의 JSON 줄 건너뜀
      }
    }

    return {
      status: 'ready',
      rows,
      message: null
    }
  } catch (error) {
    const status = detectDockerStatus(error)
    logDockerLookupDiagnostics(status, error)
    return {
      status,
      rows: [],
      message: getDockerStatusMessage(status)
    }
  }
}

export function runDockerCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return runExternalCommand('docker', args, {
    env: buildDockerCommandEnv()
  })
}

function buildDockerCommandEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  const pathEntries = [
    ...(env.PATH ? env.PATH.split(path.delimiter) : []),
    ...getDockerCandidatePaths()
  ].filter(Boolean)

  env.PATH = Array.from(new Set(pathEntries)).join(path.delimiter)
  return env
}

function getDockerCandidatePaths(): string[] {
  if (process.platform === 'darwin') {
    return [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/Applications/Docker.app/Contents/Resources/bin',
      `${process.env.HOME ?? ''}/.docker/bin`
    ]
  }

  if (process.platform === 'win32') {
    const roots = [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
      process.env.ProgramW6432,
      process.env.LOCALAPPDATA
    ].filter((value): value is string => Boolean(value))

    return roots.map((root) => path.join(root, 'Docker', 'Docker', 'resources', 'bin'))
  }

  return ['/usr/local/bin', '/usr/bin', '/snap/bin']
}

function logDockerLookupDiagnostics(
  status: 'not_installed' | 'daemon_unavailable',
  error: unknown
): void {
  if (hasLoggedDockerLookupDiagnostics) {
    return
  }

  hasLoggedDockerLookupDiagnostics = true
  logWarn('docker-images', 'Docker command lookup failed', {
    status,
    path: process.env.PATH ?? '',
    candidatePaths: getDockerCandidatePaths(),
    error: normalizeDockerError(error, 'docker command lookup failed')
  })
}

function detectDockerStatus(error: unknown): 'not_installed' | 'daemon_unavailable' {
  if (isExternalCommandError(error) && error.kind === 'command_not_found') {
    return 'not_installed'
  }

  const message = normalizeDockerError(error, '').toLowerCase()
  if (message.includes('enoent') || message.includes('not found') || message.includes('is not recognized')) {
    return 'not_installed'
  }
  return 'daemon_unavailable'
}

function getDockerStatusMessage(status: 'not_installed' | 'daemon_unavailable'): string {
  if (status === 'not_installed') {
    return tk('main.docker.status.not_installed')
  }

  return tk('main.docker.status.daemon_unavailable')
}

export function normalizeDockerError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as { stderr?: string; message?: string }
    const message = err.stderr?.trim() || err.message?.trim()
    if (message) return message
  }
  return fallback
}
