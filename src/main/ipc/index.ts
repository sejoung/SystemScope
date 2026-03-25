import { registerAppIpc } from './app.ipc'
import { registerSystemIpc } from './system.ipc'
import { registerDiskIpc } from './disk.ipc'
import { registerDockerIpc } from './docker.ipc'
import { registerProcessIpc } from './process.ipc'
import { registerAlertIpc } from './alert.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerAppsIpc } from './apps.ipc'
import { registerUpdateIpc } from './update.ipc'

export function registerAllIpc(): void {
  registerAppIpc()
  registerUpdateIpc()
  registerSystemIpc()
  registerDiskIpc()
  registerDockerIpc()
  registerProcessIpc()
  registerAppsIpc()
  registerAlertIpc()
  registerSettingsIpc()
}

export { cleanupSystemIpc } from './system.ipc'
