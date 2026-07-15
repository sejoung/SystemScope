import type { TranslationKey } from './en'
import { KO_APPLICATIONS_MESSAGES } from './ko.applications'
import { KO_CLEANUP_MESSAGES } from './ko.cleanup'
import { KO_COMMON_MESSAGES } from './ko.common'
import { KO_DEVTOOLS_MESSAGES } from './ko.devtools'
import { KO_DISK_MESSAGES } from './ko.disk'
import { KO_DOCKER_MESSAGES } from './ko.docker'
import { KO_MONITORING_MESSAGES } from './ko.monitoring'
import { KO_SETTINGS_MESSAGES } from './ko.settings'
import { KO_STARTUP_MESSAGES } from './ko.startup'
import { KO_SYSTEM_MESSAGES } from './ko.system'
import { KO_TIMELINE_MESSAGES } from './ko.timeline'

export const KO_MESSAGES: Record<TranslationKey, string> = {
  ...KO_APPLICATIONS_MESSAGES,
  ...KO_CLEANUP_MESSAGES,
  ...KO_COMMON_MESSAGES,
  ...KO_DEVTOOLS_MESSAGES,
  ...KO_DISK_MESSAGES,
  ...KO_DOCKER_MESSAGES,
  ...KO_MONITORING_MESSAGES,
  ...KO_SETTINGS_MESSAGES,
  ...KO_STARTUP_MESSAGES,
  ...KO_SYSTEM_MESSAGES,
  ...KO_TIMELINE_MESSAGES,
}
