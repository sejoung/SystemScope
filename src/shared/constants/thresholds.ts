export const ALERT_COOLDOWN_MS = 60_000
export const MAX_ACTIVE_ALERTS = 100
export const MAX_TRASH_TARGETS = 5000

export const SCAN_MAX_DEPTH = 5
export const SCAN_CONCURRENCY = 50
export const SCAN_LARGE_FILE_LIMIT = 50

/** CPU 사용률 트레이 아이콘 표시 단계별 임계값 */
export const CPU_TRAY_THRESHOLDS = {
  CRITICAL: 90,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25
} as const
