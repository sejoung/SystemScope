import { existsSync } from 'node:fs'
import * as path from 'node:path'
import type { AppLeftoverDataItem } from '@shared/types'
import { tk } from '../../i18n'

export function parseUninstallCommand(command: string): { file: string; args: string } {
  const quotedMatch = command.match(/^"([^"]+)"(.*)$/)
  if (quotedMatch) {
    return { file: quotedMatch[1], args: quotedMatch[2].trim() }
  }

  const executableMatch = command.match(/^(.+\.(?:exe|msi|bat|cmd|com))(?:\s+(.*))?$/i)
  if (executableMatch) {
    return {
      file: executableMatch[1],
      args: executableMatch[2]?.trim() ?? ''
    }
  }

  return { file: command, args: '' }
}

export function splitWindowsCommandArgs(args: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < args.length; i++) {
    const char = args[i]

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && /\s/.test(char)) {
      if (current) {
        result.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) {
    result.push(current)
  }

  return result
}

// PowerShell single-quoted literals don't interpolate $()/backticks, so doubling
// the single quote is sufficient. We also strip CR/LF/control chars so a malformed
// registry value can't span lines in the joined -Command string.
export function escapePsSingleQuote(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1F]/g, ' ').replace(/'/g, "''")
}

export function buildWindowsUninstallerPowerShellCommand(file: string, args: string[]): string {
  const escapedFile = escapePsSingleQuote(file)
  // Derive the working directory from the raw path, then escape — running
  // path.dirname on an already-escaped string would mangle paths containing quotes.
  const escapedWorkingDir = escapePsSingleQuote(path.dirname(file))
  const argListLiteral = args.length > 0
    ? `-ArgumentList @(${args.map((arg) => `'${escapePsSingleQuote(arg)}'`).join(', ')})`
    : ''
  return [
    '$ErrorActionPreference = \'Stop\'',
    `$process = Start-Process -FilePath '${escapedFile}' ${argListLiteral} -WorkingDirectory '${escapedWorkingDir}' -Verb RunAs -PassThru`,
    'if ($null -eq $process) { throw \'Failed to launch uninstaller process.\' }'
  ].join('; ')
}

// ─── Internal helpers ───

export function sanitizeRegistryValue(value?: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

export function pathExists(targetPath: string): boolean {
  if (!targetPath.trim()) return false
  return existsSync(expandWindowsEnvVars(targetPath))
}

export function commandTargetExists(command: string): boolean {
  const { file } = parseUninstallCommand(expandWindowsEnvVars(command))
  const normalized = file.trim().replace(/^"(.*)"$/, '$1')
  if (!normalized) return false

  const lower = normalized.toLowerCase()
  if (lower === 'msiexec' || lower === 'msiexec.exe' || lower === 'rundll32' || lower === 'rundll32.exe') {
    return true
  }

  if (!/[\\/]/.test(normalized)) {
    return true
  }

  return existsSync(normalized)
}

export function expandWindowsEnvVars(input: string): string {
  return input.replace(/%([^%]+)%/g, (_match, name: string) => process.env[name] ?? `%${name}%`)
}

export function currentExeIfInside(currentExe: string, installLocation: string): string | undefined {
  const normalizedInstall = installLocation.replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase()
  const normalizedExe = currentExe.replace(/[\\/]+/g, '\\').toLowerCase()
  if (normalizedExe === normalizedInstall) {
    return currentExe
  }

  return normalizedExe.startsWith(normalizedInstall + '\\') ? currentExe : undefined
}

export function getWindowsLeftoverGuidance(
  label: AppLeftoverDataItem['label']
): Pick<AppLeftoverDataItem, 'confidence' | 'reason' | 'risk'> {
  if (label === 'ProgramData') {
    return {
      confidence: 'medium',
      reason: tk('main.apps.leftover.win.programdata_reason'),
      risk: tk('main.apps.leftover.win.programdata_risk')
    }
  }

  if (label === 'Local Programs') {
    return {
      confidence: 'high',
      reason: tk('main.apps.leftover.win.local_programs_reason'),
      risk: tk('main.apps.leftover.win.local_programs_risk')
    }
  }

  return {
    confidence: 'medium',
    reason: tk('main.apps.leftover.win.default_reason', { label }),
    risk: tk('main.apps.leftover.win.default_risk')
  }
}
