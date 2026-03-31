import { registerAppIpc } from './app.ipc'
import { registerSystemIpc } from './system.ipc'
import { registerDiskIpc } from './disk.ipc'
import { registerDockerIpc } from './docker.ipc'
import { registerProcessIpc } from './process.ipc'
import { registerAlertIpc } from './alert.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerAppsIpc } from './apps.ipc'
import { registerUpdateIpc } from './update.ipc'
import { registerEventIpc } from './event.ipc'
import { registerTimelineIpc } from './timeline.ipc'
import { registerDiagnosisIpc } from './diagnosis.ipc'
import { registerAlertIntelligenceIpc } from './alertIntelligence.ipc'

export function registerAllIpc(): void {
  registerAppIpc()
  registerUpdateIpc()
  registerSystemIpc()
  registerDiskIpc()
  registerDockerIpc()
  registerProcessIpc()
  registerAppsIpc()
  registerAlertIpc()
  registerAlertIntelligenceIpc()
  registerSettingsIpc()
  registerEventIpc()
  registerTimelineIpc()
  registerDiagnosisIpc()
}

export { cleanupSystemIpc } from './system.ipc'
