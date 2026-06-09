import { getSettings } from '../store/settingsStore'
import { setThresholds } from '@main/services/alerts'

export function initializeRuntimeSettings(): void {
  const settings = getSettings()
  setThresholds(settings.thresholds)
}
