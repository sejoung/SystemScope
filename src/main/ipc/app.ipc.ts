import { ipcMain } from 'electron'
import log from 'electron-log'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { failure, success } from '@shared/types'

export function registerAppIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.APP_LOG_RENDERER_ERROR,
    (_event, payload: { scope?: unknown; message?: unknown; details?: unknown }) => {
      if (!payload || typeof payload !== 'object') {
        return failure('INVALID_INPUT', '유효하지 않은 로그 payload입니다.')
      }

      const scope = typeof payload.scope === 'string' ? payload.scope : 'renderer'
      const message = typeof payload.message === 'string' ? payload.message : null
      if (!message) {
        return failure('INVALID_INPUT', '유효하지 않은 로그 메시지입니다.')
      }

      log.error(`[${scope}] ${message}`, payload.details)
      return success(true)
    }
  )
}
