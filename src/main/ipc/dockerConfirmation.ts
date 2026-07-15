import { BrowserWindow, dialog } from 'electron'
import { tk } from '../i18n'

interface ConfirmDialogOptions {
  actionButton: string
  title: string
  message: string
  detailLines: (string | null)[]
}

export function getActiveWindow(): BrowserWindow | null {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  return win && !win.isDestroyed() ? win : null
}

export async function showConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  const win = getActiveWindow()
  if (!win) return false

  const confirm = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: [tk('docker.ipc.confirm.cancel'), options.actionButton],
    defaultId: 0,
    cancelId: 0,
    title: options.title,
    message: options.message,
    detail: options.detailLines.filter(Boolean).join('\n')
  })

  return confirm.response !== 0
}

export function buildTargetDetailLines(
  labels: string[],
  totalCount: number,
  footerLines: string[]
): (string | null)[] {
  return [
    ...labels.slice(0, 5),
    totalCount > 5 ? tk('docker.ipc.confirm.more', { count: totalCount - 5 }) : null,
    '',
    ...footerLines
  ]
}

