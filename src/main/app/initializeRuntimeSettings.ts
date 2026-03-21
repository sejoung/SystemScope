import { getSettings } from '../store/settingsStore'
import { setThresholds } from '../services/alertManager'

export function initializeRuntimeSettings(): void {
  const settings = getSettings()
  setThresholds(settings.thresholds)
}
