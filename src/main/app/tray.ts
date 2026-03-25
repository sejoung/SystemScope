import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { platform } from 'os'
import { logError } from '../services/logging'
import { getSystemStats } from '../services/systemMonitor'
import { getCpuMeterText } from './trayIconFactory'
import { CPU_TRAY_THRESHOLDS } from '@shared/constants/thresholds'
import { openAboutWindow } from './aboutWindow'
import { checkForUpdates, getUpdateStatus, openReleasePage } from '../services/updateChecker'

let tray: Tray | null = null
let trayUpdateTimer: ReturnType<typeof setInterval> | null = null
let pulseFrame = false
let lastVisualKey = ''
const cpuSamples: number[] = []

export function createTray(): void {
  if (tray) return

  try {
    const icon = getInitialTrayIcon()
    tray = new Tray(icon)
  } catch (err) {
    logError('tray', 'Failed to create tray icon', err)
    tray = null
    return
  }

  tray.setToolTip('SystemScope')
  rebuildTrayMenu()

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

    // macOS: 트레이 타이틀에 CPU 미터 텍스트 표시
    if (process.platform === 'darwin') {
      const isHighLoad = roundedUsage >= CPU_TRAY_THRESHOLDS.HIGH
      pulseFrame = isHighLoad ? !pulseFrame : false

      const level = roundedUsage >= CPU_TRAY_THRESHOLDS.CRITICAL ? 4
        : roundedUsage >= CPU_TRAY_THRESHOLDS.HIGH ? 3
        : roundedUsage >= CPU_TRAY_THRESHOLDS.MEDIUM ? 2
        : roundedUsage >= CPU_TRAY_THRESHOLDS.LOW ? 1 : 0
      const visualKey = `${level}:${pulseFrame ? 1 : 0}`
      if (visualKey !== lastVisualKey) {
        tray.setTitle(getCpuMeterText(roundedUsage, pulseFrame))
        lastVisualKey = visualKey
      }
    }

    tray.setToolTip(`SystemScope\nCPU ${roundedUsage}%`)
    rebuildTrayMenu()
  } catch (error) {
    logError('tray', 'Failed to refresh tray icon', error)
  }
}

function rebuildTrayMenu(): void {
  if (!tray) return

  const updateStatus = getUpdateStatus()
  const updateInfo = updateStatus.updateInfo?.hasUpdate ? updateStatus.updateInfo : null

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    {
      label: 'Check for Updates',
      click: () => {
        void checkForUpdates({ source: 'manual' }).finally(() => {
          rebuildTrayMenu()
        })
      }
    },
    ...(updateInfo
      ? [
          {
            label: `Download v${updateInfo.latestVersion}`,
            click: () => {
              void openReleasePage(updateInfo.releaseUrl)
            }
          } as const
        ]
      : []),
    {
      label: 'About',
      click: () => {
        openAboutWindow()
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
}

function getInitialTrayIcon(): Electron.NativeImage {
  if (process.platform === 'darwin') {
    const icon = nativeImage.createFromPath(join(getResourcesPath(), 'trayTemplate.png'))
    icon.setTemplateImage(true)
    return icon
  }
  // Windows: dedicated tray asset for better small-size rendering.
  return nativeImage.createFromPath(join(getResourcesPath(), 'tray_win.png')).resize({ width: 16, height: 16 })
}

function getResourcesPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources')
  }
  return join(app.getAppPath(), 'resources')
}
