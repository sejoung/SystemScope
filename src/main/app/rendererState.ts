const unsavedSettingsBySenderId = new Map<number, boolean>()

export function setUnsavedSettingsState(senderId: number, value: boolean): void {
  if (value) {
    unsavedSettingsBySenderId.set(senderId, true)
    return
  }

  unsavedSettingsBySenderId.delete(senderId)
}

export function getUnsavedSettingsState(senderId: number): boolean {
  return unsavedSettingsBySenderId.get(senderId) === true
}

export function clearUnsavedSettingsState(senderId: number): void {
  unsavedSettingsBySenderId.delete(senderId)
}
