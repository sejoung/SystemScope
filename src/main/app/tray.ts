import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { platform } from 'os'

let tray: Tray | null = null

export function createTray(): void {
  if (tray) return

  const icon = getTrayIcon()
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
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

function getTrayIcon(): Electron.NativeImage {
  const resourcesPath = getResourcesPath()

  if (platform() === 'darwin') {
    // macOS: Template Image — 파일 이름에 Template이 포함되면 자동 dark/light 대응
    const icon = nativeImage.createFromPath(join(resourcesPath, 'trayTemplate.png'))
    icon.setTemplateImage(true)
    return icon
  }

  // Windows
  return nativeImage.createFromPath(join(resourcesPath, 'tray_win.png'))
}

function getResourcesPath(): string {
  // 개발 모드: 프로젝트 루트의 resources/
  // 프로덕션: app.asar 밖의 resources/
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources')
  }
  return join(app.getAppPath(), 'resources')
}
