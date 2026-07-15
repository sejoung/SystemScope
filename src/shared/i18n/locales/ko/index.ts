import type { TranslationKey } from '../en'
import { KO_APPLICATIONS_MESSAGES } from './applications'
import { KO_CLEANUP_MESSAGES } from './cleanup'
import { KO_COMMON_MESSAGES } from './common'
import { KO_DEVTOOLS_MESSAGES } from './devtools'
import { KO_DISK_MESSAGES } from './disk'
import { KO_DOCKER_MESSAGES } from './docker'
import { KO_MONITORING_MESSAGES } from './monitoring'
import { KO_SETTINGS_MESSAGES } from './settings'
import { KO_STARTUP_MESSAGES } from './startup'
import { KO_SYSTEM_MESSAGES } from './system'
import { KO_TIMELINE_MESSAGES } from './timeline'

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
