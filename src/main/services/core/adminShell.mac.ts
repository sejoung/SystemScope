import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
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

/**
 * Move root-owned (or otherwise permission-blocked) items to the user's Trash through
 * one administrator password prompt. Ownership is handed back to the user so the Trash
 * can be inspected/emptied without further prompts. The shell ignores per-line failures,
 * so success is verified per item by checking the path actually left its directory.
 */
export async function adminMoveToTrash(targets: string[]): Promise<{ moved: string[]; failed: string[] }> {
  const trashDir = path.join(homedir(), '.Trash')
  const uid = process.getuid?.() ?? 0
  const gid = process.getgid?.() ?? 0

  const lines = targets.flatMap((target) => {
    // Path-derived suffix keeps same-named items from different directories from colliding.
    const suffix = createHash('sha256').update(target).digest('hex').slice(0, 8)
    const trashPath = path.join(trashDir, `${path.basename(target)}.${suffix}`)
    return [
      `mv -f ${shellQuote(target)} ${shellQuote(trashPath)}`,
      `chown -R ${uid}:${gid} ${shellQuote(trashPath)} 2>/dev/null || true`,
    ]
  })

  try {
    await runAdminShellScript(lines.join('\n'))
  } catch {
    // Canceled or failed — per-item verification below decides what actually moved.
  }

  const moved: string[] = []
  const failed: string[] = []
  for (const target of targets) {
    const stillPresent = await fs.lstat(target).then(() => true).catch(() => false)
    ;(stillPresent ? failed : moved).push(target)
  }
  return { moved, failed }
}
