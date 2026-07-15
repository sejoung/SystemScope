import { BrowserWindow, ipcMain as electronIpcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { failure } from '@shared/types'

type InvokeHandler = Parameters<typeof electronIpcMain.handle>[1]

export function isTrustedRendererUrl(rawUrl: string): boolean {
  try {
    const candidate = new URL(rawUrl)
    const developmentUrl = process.env.NODE_ENV === 'development'
      ? process.env.ELECTRON_RENDERER_URL
      : undefined

    if (developmentUrl) {
      const expected = new URL(developmentUrl)
      return candidate.origin === expected.origin
    }

    return candidate.protocol === 'file:' && candidate.pathname.endsWith('/renderer/index.html')
  } catch {
    return false
  }
}

export function isTrustedIpcSender(event: IpcMainInvokeEvent): boolean {
  if (process.env.NODE_ENV === 'test') {
    return true
  }

  const owner = BrowserWindow.fromWebContents(event.sender)
  if (!owner || owner.isDestroyed()) {
    return false
  }

  const senderUrl = event.senderFrame?.url || event.sender.getURL()
  return isTrustedRendererUrl(senderUrl)
}

export const ipcMain = {
  handle(channel: string, listener: InvokeHandler): void {
    electronIpcMain.handle(channel, (event, ...args) => {
      if (!isTrustedIpcSender(event)) {
        return failure('PERMISSION_DENIED', 'Untrusted IPC sender')
      }
      return listener(event, ...args)
    })
  }
}
