import type { DiagnosisResult, DiagnosisSummary, DiagnosisSeverity } from '@shared/types'
import { logInfo, logWarn, logError } from '@main/services/core/logging'

import { systemDiagnosisRules, type DiagnosisRule } from './diagnosisRules.system'
import { workspaceDiagnosisRules } from './diagnosisRules.workspace'

const SEVERITY_ORDER: Record<DiagnosisSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2
}

const DEFAULT_INTERVAL_SEC = 300 // 5 minutes
const CACHE_TTL_MS = 60_000

let cachedSummary: DiagnosisSummary | null = null
let cachedAt = 0
let diagnosisTimer: ReturnType<typeof setTimeout> | null = null
let diagnosisInFlight: Promise<DiagnosisSummary> | null = null
let diagnosisRunning = false

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const rules: DiagnosisRule[] = [...systemDiagnosisRules, ...workspaceDiagnosisRules]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initDiagnosisAdvisor(): Promise<void> {
  logInfo('diagnosis-advisor', 'Initializing diagnosis advisor')
  if (diagnosisTimer) clearTimeout(diagnosisTimer)
  diagnosisTimer = null
  diagnosisRunning = true

  // Run initial diagnosis
  try {
    await runDiagnosis()
  } catch (err) {
    logWarn('diagnosis-advisor', 'Initial diagnosis run failed', { error: err })
  }

  scheduleNextDiagnosis()

  logInfo('diagnosis-advisor', 'Diagnosis advisor started', { intervalSec: DEFAULT_INTERVAL_SEC })
}

export function stopDiagnosisAdvisor(): void {
  diagnosisRunning = false
  if (diagnosisTimer) {
    clearTimeout(diagnosisTimer)
    diagnosisTimer = null
  }
  logInfo('diagnosis-advisor', 'Diagnosis advisor stopped')
}

export async function getDiagnosisSummary(): Promise<DiagnosisSummary> {
  const now = Date.now()
  if (cachedSummary && now - cachedAt < CACHE_TTL_MS) {
    return cachedSummary
  }
  return runDiagnosis()
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function runDiagnosis(): Promise<DiagnosisSummary> {
  if (diagnosisInFlight) return diagnosisInFlight
  const request = collectDiagnosis().finally(() => {
    if (diagnosisInFlight === request) diagnosisInFlight = null
  })
  diagnosisInFlight = request
  return request
}

async function collectDiagnosis(): Promise<DiagnosisSummary> {
  const results: DiagnosisResult[] = []

  const evaluations = await Promise.allSettled(
    rules.map(async (rule) => {
      try {
        return await rule.evaluate()
      } catch (err) {
        logWarn('diagnosis-advisor', `Rule "${rule.category}" failed`, { error: err })
        return null
      }
    })
  )

  for (const outcome of evaluations) {
    if (outcome.status === 'fulfilled' && outcome.value !== null) {
      results.push(outcome.value)
    } else if (outcome.status === 'rejected') {
      logError('diagnosis-advisor', 'Rule evaluation rejected unexpectedly', { reason: outcome.reason })
    }
  }

  // Sort by severity: critical first, then warning, then info
  results.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  const summary: DiagnosisSummary = {
    results,
    analyzedAt: Date.now()
  }

  cachedSummary = summary
  cachedAt = Date.now()

  logInfo('diagnosis-advisor', 'Diagnosis completed', { resultCount: results.length })
  return summary
}

function scheduleNextDiagnosis(): void {
  if (!diagnosisRunning) return
  if (diagnosisTimer) clearTimeout(diagnosisTimer)
  diagnosisTimer = setTimeout(() => {
    void runDiagnosis().catch((error) => {
      logWarn('diagnosis-advisor', 'Periodic diagnosis run failed', { error })
    }).finally(() => {
      scheduleNextDiagnosis()
    })
  }, DEFAULT_INTERVAL_SEC * 1000)
  diagnosisTimer.unref?.()
}
