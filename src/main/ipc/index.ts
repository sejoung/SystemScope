import { registerAppIpc } from './app.ipc'
import { registerSystemIpc } from './system.ipc'
import { registerDiskIpc } from './disk'
import { registerDockerIpc } from './docker'
import { registerProcessIpc } from './process.ipc'
import { registerAlertIpc } from './alert/alert.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerAppsIpc } from './apps.ipc'
import { registerUpdateIpc } from './update.ipc'
import { registerEventIpc } from './event.ipc'
import { registerTimelineIpc } from './timeline.ipc'
import { registerDiagnosisIpc } from './diagnosis.ipc'
import { registerAlertIntelligenceIpc } from './alert/alertIntelligence.ipc'
import { registerCleanupInboxIpc } from './cleanup/cleanupInbox.ipc'
import { registerCleanupIpc } from './cleanup/cleanup.ipc'
import { registerReportIpc } from './report.ipc'
import { registerSessionSnapshotIpc } from './sessionSnapshot.ipc'
import { registerProfileIpc } from './profile.ipc'
import { registerDevToolsIpc } from './devTools.ipc'
import { registerStartupIpc } from './startup.ipc'
import { registerProjectMonitorIpc } from './projectMonitor.ipc'

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
  registerCleanupInboxIpc()
  registerCleanupIpc()
  registerReportIpc()
  registerSessionSnapshotIpc()
  registerProfileIpc()
  registerDevToolsIpc()
  registerStartupIpc()
  registerProjectMonitorIpc()
}

export { cleanupSystemIpc } from './system.ipc'
