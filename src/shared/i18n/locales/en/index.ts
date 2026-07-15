import { EN_APPLICATIONS_MESSAGES } from './applications'
import { EN_CLEANUP_MESSAGES } from './cleanup'
import { EN_COMMON_MESSAGES } from './common'
import { EN_DEVTOOLS_MESSAGES } from './devtools'
import { EN_DISK_MESSAGES } from './disk'
import { EN_DOCKER_MESSAGES } from './docker'
import { EN_MONITORING_MESSAGES } from './monitoring'
import { EN_SETTINGS_MESSAGES } from './settings'
import { EN_STARTUP_MESSAGES } from './startup'
import { EN_SYSTEM_MESSAGES } from './system'
import { EN_TIMELINE_MESSAGES } from './timeline'

export const EN_MESSAGES = {
  ...EN_APPLICATIONS_MESSAGES,
  ...EN_CLEANUP_MESSAGES,
  ...EN_COMMON_MESSAGES,
  ...EN_DEVTOOLS_MESSAGES,
  ...EN_DISK_MESSAGES,
  ...EN_DOCKER_MESSAGES,
  ...EN_MONITORING_MESSAGES,
  ...EN_SETTINGS_MESSAGES,
  ...EN_STARTUP_MESSAGES,
  ...EN_SYSTEM_MESSAGES,
  ...EN_TIMELINE_MESSAGES,
} as const

export type TranslationKey = keyof typeof EN_MESSAGES
