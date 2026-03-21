export type AlertType = 'disk' | 'memory' | 'gpu'
export type AlertSeverity = 'warning' | 'critical'

export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  message: string
  value: number
  threshold: number
  timestamp: number
  dismissed: boolean
}

export interface AlertThresholds {
  diskWarning: number
  diskCritical: number
  memoryWarning: number
  memoryCritical: number
  gpuMemoryWarning: number
  gpuMemoryCritical: number
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  diskWarning: 80,
  diskCritical: 90,
  memoryWarning: 80,
  memoryCritical: 90,
  gpuMemoryWarning: 80,
  gpuMemoryCritical: 90
}
