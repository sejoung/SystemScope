import type { CleanupRuleId } from '@shared/types'
import { getSettings, setSettings } from '../store/settingsStore'
import { executeCleanup, previewCleanup } from './cleanupRules'
import { getActiveProfile } from './profileManager'
import { recordEvent } from './eventStore'
import { logInfo, logWarn } from './logging'
import { refreshProjectMonitor } from './projectMonitor'

const SAFE_AUTOMATION_RULE_IDS = new Set<CleanupRuleId>([
  'npm_cache',
  'pnpm_cache',
  'yarn_cache',
  'docker_stopped_containers',
  'old_logs',
  'temp_files'
])
const HOURLY_CHECK_MS = 60 * 60 * 1000

let automationTimer: ReturnType<typeof setInterval> | null = null

export function initAutomationScheduler(): void {
  restartAutomationScheduler()
}

export function restartAutomationScheduler(): void {
  stopAutomationScheduler()

  void maybeRunAutomatedTasks('startup').catch((error) => {
    logWarn('automation-scheduler', 'Startup automation run failed', { error })
  })

  automationTimer = setInterval(() => {
    void maybeRunAutomatedTasks('interval').catch((error) => {
      logWarn('automation-scheduler', 'Scheduled automation run failed', { error })
    })
  }, HOURLY_CHECK_MS)
}

export function stopAutomationScheduler(): void {
  if (automationTimer) {
    clearInterval(automationTimer)
    automationTimer = null
  }
}

async function maybeRunAutomatedTasks(reason: 'startup' | 'interval'): Promise<void> {
  await refreshProjectMonitor().catch((error) => {
    logWarn('automation-scheduler', 'Project monitor refresh failed', { error, reason })
  })

  const settings = getSettings()
  const schedule = settings.automation.schedule
  if (!schedule.enabled || schedule.frequency === 'manual') {
    return
  }

  if (!isScheduleDue(schedule.frequency, schedule.lastRunAt)) {
    return
  }

  const preview = await previewCleanup()
  const workspacePaths = new Set((getActiveProfile()?.workspacePaths ?? []).map((entry) => entry.trim()).filter(Boolean))
  const eligiblePaths = preview.items
    .filter((item) => SAFE_AUTOMATION_RULE_IDS.has(item.rule))
    .filter((item) => !Array.from(workspacePaths).some((workspacePath) => item.path.startsWith(workspacePath)))
    .map((item) => item.path)

  if (eligiblePaths.length > 0) {
    const result = await executeCleanup(eligiblePaths)
    void recordEvent('system', 'info', `Automated cleanup executed (${reason})`, undefined, {
      requestedCount: eligiblePaths.length,
      deletedCount: result.deletedCount,
      failedCount: result.failedCount,
      deletedSize: result.deletedSize
    })
    logInfo('automation-scheduler', 'Automated cleanup executed', {
      reason,
      requestedCount: eligiblePaths.length,
      deletedCount: result.deletedCount,
      failedCount: result.failedCount
    })
  } else {
    logInfo('automation-scheduler', 'Automated cleanup skipped because no safe targets were found', { reason })
  }

  setSettings({
    automation: {
      ...settings.automation,
      schedule: {
        ...schedule,
        lastRunAt: Date.now()
      }
    }
  })
}

function isScheduleDue(frequency: 'daily' | 'weekly' | 'manual', lastRunAt?: number): boolean {
  if (!lastRunAt) {
    return true
  }

  const intervalMs = frequency === 'daily'
    ? 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000

  return Date.now() - lastRunAt >= intervalMs
}
