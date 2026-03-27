import { app, BrowserWindow } from 'electron'
import * as fs from 'node:fs'
import { join } from 'node:path'
import { getSettings } from '../store/settingsStore'

let aboutWindow: BrowserWindow | null = null

export interface AboutInfo {
  appName: string
  version: string
  author: string
  homepage: string | null
  license: string | null
}

export function openAboutWindow(): BrowserWindow {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    if (!aboutWindow.isVisible()) {
      aboutWindow.show()
    }
    aboutWindow.focus()
    return aboutWindow
  }

  const { theme } = getSettings()
  aboutWindow = new BrowserWindow({
    width: 420,
    height: 520,
    minWidth: 420,
    minHeight: 520,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    title: 'About SystemScope',
    titleBarStyle: 'default',
    backgroundColor: theme === 'light' ? '#f8fafc' : '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  aboutWindow.once('ready-to-show', () => {
    aboutWindow?.show()
  })

  aboutWindow.on('closed', () => {
    aboutWindow = null
  })

  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('window', 'about')
    void aboutWindow.loadURL(url.toString())
  } else {
    void aboutWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'about' }
    })
  }

  return aboutWindow
}

export function getAboutInfo(): AboutInfo {
  const metadata = readPackageMetadata()
  return {
    appName: metadata.appName || app.getName(),
    version: metadata.version || app.getVersion(),
    author: metadata.author || 'Sejoung',
    homepage: metadata.homepage,
    license: metadata.license
  }
}

export function getHomepageUrl(): string | null {
  return readPackageMetadata().homepage
}

function readPackageMetadata(): {
  appName: string
  version: string
  author: string
  homepage: string | null
  license: string | null
} {
  try {
    const packagePath = join(app.getAppPath(), 'package.json')
    const raw = fs.readFileSync(packagePath, 'utf-8')
    const parsed = JSON.parse(raw) as {
      name?: unknown
      version?: unknown
      author?: unknown
      homepage?: unknown
      license?: unknown
      build?: {
        productName?: unknown
      }
    }
    return {
      appName:
        typeof parsed.build?.productName === 'string'
          ? parsed.build.productName
          : typeof parsed.name === 'string'
            ? parsed.name
            : '',
      version: typeof parsed.version === 'string' ? parsed.version : '',
      author: typeof parsed.author === 'string' ? parsed.author : '',
      homepage: typeof parsed.homepage === 'string' ? parsed.homepage : null,
      license: typeof parsed.license === 'string' ? parsed.license : null
    }
  } catch {
    return {
      appName: '',
      version: '',
      author: '',
      homepage: null,
      license: null
    }
  }
}
