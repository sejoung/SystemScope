import { registerAppIpc } from './app.ipc'
import { registerSystemIpc } from './system.ipc'
import { registerDiskIpc } from './disk.ipc'
import { registerProcessIpc } from './process.ipc'
import { registerAlertIpc } from './alert.ipc'
import { registerSettingsIpc } from './settings.ipc'

export function registerAllIpc(): void {
  registerAppIpc()
  registerSystemIpc()
  registerDiskIpc()
  registerProcessIpc()
  registerAlertIpc()
  registerSettingsIpc()
}

export { cleanupSystemIpc } from './system.ipc'
