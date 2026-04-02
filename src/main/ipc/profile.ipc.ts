import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import type { WorkspaceProfile } from '@shared/types'
import { getProfiles, saveProfile, deleteProfile, setActiveProfile } from '../services/profileManager'
import { isWorkspaceProfileValue } from '../store/settingsSchema'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerProfileIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PROFILE_GET_ALL, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const profiles = getProfiles()
      logInfoAction('profile-ipc', 'profile.getAll', withRequestMeta(requestMeta, { count: profiles.length }))
      return success(profiles)
    } catch (err) {
      logErrorAction('profile-ipc', 'profile.getAll', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get profiles')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROFILE_SAVE, (_event, profile: WorkspaceProfile, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      if (!isWorkspaceProfileValue(profile, { allowEmptyId: true })) {
        return failure('INVALID_INPUT', 'Invalid profile data')
      }
      const saved = saveProfile(profile)
      logInfoAction('profile-ipc', 'profile.save', withRequestMeta(requestMeta, { id: saved.id, name: saved.name }))
      return success(saved)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save profile'
      logErrorAction('profile-ipc', 'profile.save', withRequestMeta(requestMeta, { error: err }))
      return failure('INVALID_INPUT', message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROFILE_DELETE, (_event, id: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      if (!id || typeof id !== 'string') {
        return failure('INVALID_INPUT', 'Profile ID is required')
      }
      const deleted = deleteProfile(id)
      logInfoAction('profile-ipc', 'profile.delete', withRequestMeta(requestMeta, { id, deleted }))
      return success(deleted)
    } catch (err) {
      logErrorAction('profile-ipc', 'profile.delete', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to delete profile')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROFILE_SET_ACTIVE, (_event, id: string | null, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      if (id !== null && (typeof id !== 'string' || !id)) {
        return failure('INVALID_INPUT', 'Profile ID must be a non-empty string or null')
      }
      const profile = setActiveProfile(id)
      logInfoAction('profile-ipc', 'profile.setActive', withRequestMeta(requestMeta, { id, name: profile?.name ?? null }))
      return success(profile)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set active profile'
      logErrorAction('profile-ipc', 'profile.setActive', withRequestMeta(requestMeta, { error: err }))
      return failure('INVALID_INPUT', message)
    }
  })
}
