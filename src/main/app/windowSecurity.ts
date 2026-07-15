import type { BrowserWindow, Event } from 'electron'

function isSameRendererLocation(rawUrl: string, expectedUrl: string): boolean {
  try {
    const candidate = new URL(rawUrl)
    const expected = new URL(expectedUrl)
    return candidate.protocol === expected.protocol
      && candidate.host === expected.host
      && candidate.pathname === expected.pathname
  } catch {
    return false
  }
}

export function secureRendererWindow(win: BrowserWindow, expectedUrl: string): void {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const blockUnexpectedNavigation = (event: Event, targetUrl: string): void => {
    if (!isSameRendererLocation(targetUrl, expectedUrl)) {
      event.preventDefault()
    }
  }

  win.webContents.on('will-navigate', blockUnexpectedNavigation)
  win.webContents.on('will-redirect', blockUnexpectedNavigation)
}
