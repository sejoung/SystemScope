import { registerSystemIpc } from './system.ipc'
import { registerDiskIpc } from './disk.ipc'
import { registerProcessIpc } from './process.ipc'
import { registerAlertIpc } from './alert.ipc'
import { registerSettingsIpc } from './settings.ipc'

export function registerAllIpc(): void {
  registerSystemIpc()
  registerDiskIpc()
  registerProcessIpc()
  registerAlertIpc()
  registerSettingsIpc()
}

export { cleanupSystemIpc } from './system.ipc'
