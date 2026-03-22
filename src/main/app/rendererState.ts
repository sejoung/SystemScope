let hasUnsavedSettings = false

export function setUnsavedSettingsState(value: boolean): void {
  hasUnsavedSettings = value
}

export function getUnsavedSettingsState(): boolean {
  return hasUnsavedSettings
}
