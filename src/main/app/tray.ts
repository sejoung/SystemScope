import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { platform } from 'os'
import log from 'electron-log'
import { getSystemStats } from '../services/systemMonitor'
import { createTrayImage, getCpuMeterText } from './trayIconFactory'

let tray: Tray | null = null
let trayUpdateTimer: ReturnType<typeof setInterval> | null = null
let pulseFrame = false
let lastVisualKey = ''
const cpuSamples: number[] = []

export function createTray(): void {
  if (tray) return

  const icon = getInitialTrayIcon()
  tray = new Tray(icon)

  tray.setToolTip('SystemScope')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show SystemScope',
      click: () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Windows에서만 좌클릭 시 창 표시 (macOS는 좌클릭 = 메뉴 표시가 기본 동작)
  if (platform() !== 'darwin') {
    tray.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    })
  }

  void refreshTrayIcon()
  trayUpdateTimer = setInterval(() => {
    void refreshTrayIcon()
  }, 2000)
}

export function destroyTray(): void {
  if (trayUpdateTimer) {
    clearInterval(trayUpdateTimer)
    trayUpdateTimer = null
  }
  cpuSamples.length = 0
  pulseFrame = false
  lastVisualKey = ''
  if (tray) {
    tray.destroy()
    tray = null
  }
}

async function refreshTrayIcon(): Promise<void> {
  if (!tray) return

  try {
    const stats = await getSystemStats()
    cpuSamples.push(stats.cpu.usage)
    if (cpuSamples.length > 3) {
      cpuSamples.shift()
    }

    const averageUsage = cpuSamples.reduce((sum, value) => sum + value, 0) / cpuSamples.length
    const roundedUsage = Math.round(averageUsage)
    const isHighLoad = roundedUsage >= 75
    pulseFrame = isHighLoad ? !pulseFrame : false

    const visualKey = `${roundedUsage >= 90 ? 4 : roundedUsage >= 75 ? 3 : roundedUsage >= 50 ? 2 : roundedUsage >= 25 ? 1 : 0}:${pulseFrame ? 1 : 0}:${process.platform}`
    if (visualKey !== lastVisualKey) {
      if (process.platform === 'darwin') {
        tray.setTitle(getCpuMeterText(roundedUsage, pulseFrame))
      } else {
        tray.setImage(createTrayImage(roundedUsage, pulseFrame, process.platform))
      }
      lastVisualKey = visualKey
    }

    tray.setToolTip(`SystemScope\nCPU ${roundedUsage}%`)
  } catch (error) {
    log.error('Failed to refresh tray icon', error)
  }
}

function getInitialTrayIcon(): Electron.NativeImage {
  if (process.platform === 'darwin') {
    const icon = nativeImage.createFromPath(join(getResourcesPath(), 'trayTemplate.png'))
    icon.setTemplateImage(true)
    return icon
  }
  return createTrayImage(0, false, process.platform)
}

function getResourcesPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources')
  }
  return join(app.getAppPath(), 'resources')
}
