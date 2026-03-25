import { contextBridge } from 'electron'
import { createE2EMockApi } from './createE2EMockApi'
import { createIpcApi } from './createIpcApi'

const e2eMock = process.env.E2E_LIGHTWEIGHT === '1' ? createE2EMockApi() : null
const api = e2eMock ? e2eMock.api : createIpcApi()

contextBridge.exposeInMainWorld('systemScope', api)
contextBridge.exposeInMainWorld('__E2E_LIGHTWEIGHT', process.env.E2E_LIGHTWEIGHT === '1')
if (e2eMock) {
  contextBridge.exposeInMainWorld('__E2E_CONTROLS__', e2eMock.controls)
}

export type { SystemScopeApi } from '@shared/contracts/systemScope'
