import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { failure, success } from '@shared/types'
import { t } from '../i18n'
import { checkForUpdates, getUpdateStatus, openReleasePage } from '../services/updateChecker'
import { logErrorAction, logInfoAction, logWarnAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerUpdateIpc(): void {
  ipcMain.handle(IPC_CHANNELS.UPDATE_GET_STATUS, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    logInfoAction('update-ipc', 'status.get', withRequestMeta(requestMeta))
    return success(getUpdateStatus())
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)

    try {
      const status = await checkForUpdates({ source: 'manual' })
      logInfoAction('update-ipc', 'check.manual', withRequestMeta(requestMeta, { hasUpdate: status.updateInfo?.hasUpdate ?? false }))
      return success(status)
    } catch (error) {
      logErrorAction('update-ipc', 'check.manual', withRequestMeta(requestMeta, { error }))
      return failure('UNKNOWN_ERROR', t('Unable to check for updates right now.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_OPEN_RELEASE, async (_event, releaseUrl: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)

    if (typeof releaseUrl !== 'string' || !releaseUrl) {
      logWarnAction('update-ipc', 'release.open', withRequestMeta(requestMeta, { reason: 'invalid_url' }))
      return failure('INVALID_INPUT', t('Unable to open the release download page.'))
    }

    try {
      const opened = await openReleasePage(releaseUrl)
      if (!opened) {
        logWarnAction('update-ipc', 'release.open', withRequestMeta(requestMeta, { reason: 'blocked_url', releaseUrl }))
        return failure('PERMISSION_DENIED', t('Unable to open the release download page.'))
      }

      logInfoAction('update-ipc', 'release.open', withRequestMeta(requestMeta, { releaseUrl }))
      return success(true)
    } catch (error) {
      logErrorAction('update-ipc', 'release.open', withRequestMeta(requestMeta, { error, releaseUrl }))
      return failure('UNKNOWN_ERROR', t('Unable to open the release download page.'))
    }
  })
}
