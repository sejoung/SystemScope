import { runExternalCommand } from '@main/services/core/externalCommand'

/** Generous: the prompt waits on the user typing their password. */
const ADMIN_PROMPT_TIMEOUT_MS = 120000

/** Quote a value for safe interpolation into a POSIX shell command line. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Run a shell script through a single macOS administrator password prompt.
 * The script is passed via argv (not interpolated into the AppleScript source)
 * so no AppleScript string escaping is needed. Throws a friendly error when the
 * user dismisses the password dialog.
 */
export async function runAdminShellScript(script: string): Promise<void> {
  try {
    await runExternalCommand(
      'osascript',
      [
        '-e', 'on run argv',
        '-e', 'do shell script (item 1 of argv) with administrator privileges',
        '-e', 'end run',
        script,
      ],
      { timeout: ADMIN_PROMPT_TIMEOUT_MS }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('User canceled') || message.includes('-128')) {
      throw new Error('Administrator authorization was canceled', { cause: err })
    }
    throw err
  }
}
