import { EN_APPLICATIONS_MESSAGES } from './en.applications'
import { EN_CLEANUP_MESSAGES } from './en.cleanup'
import { EN_COMMON_MESSAGES } from './en.common'
import { EN_DEVTOOLS_MESSAGES } from './en.devtools'
import { EN_DISK_MESSAGES } from './en.disk'
import { EN_DOCKER_MESSAGES } from './en.docker'
import { EN_MONITORING_MESSAGES } from './en.monitoring'
import { EN_SETTINGS_MESSAGES } from './en.settings'
import { EN_STARTUP_MESSAGES } from './en.startup'
import { EN_SYSTEM_MESSAGES } from './en.system'
import { EN_TIMELINE_MESSAGES } from './en.timeline'

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
