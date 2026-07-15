import { contextBridge } from 'electron'
import { createIpcApi } from './createIpcApi'
import { createE2EMockApi } from './__e2e__/createE2EMockApi'
import type { SystemScopeApi } from '@shared/contracts/systemScope'

// Injected by electron-vite: true only for `--mode e2e` builds. In production builds
// it's the literal `false`, so `isLightweight` folds to false and the unused
// createE2EMockApi import is tree-shaken out — the mock never ships in the packaged app.
declare const __E2E__: boolean

const isLightweight = __E2E__ && process.env.E2E_LIGHTWEIGHT === '1'

let api: SystemScopeApi
let e2eControls: unknown = null

if (isLightweight) {
  const mock = createE2EMockApi()
  api = mock.api
  e2eControls = mock.controls
} else {
  api = createIpcApi()
}

const preloadLocation = (globalThis as { location?: { search?: string } }).location
const isAboutWindow = Boolean(preloadLocation
  && new URLSearchParams(preloadLocation.search ?? '').get('window') === 'about')
const exposedApi = isAboutWindow
  ? {
      logRendererError: api.logRendererError,
      getAboutInfo: api.getAboutInfo,
      openHomepage: api.openHomepage
    }
  : api

contextBridge.exposeInMainWorld('systemScope', exposedApi)
contextBridge.exposeInMainWorld('__E2E_LIGHTWEIGHT', isLightweight)
if (e2eControls) {
  contextBridge.exposeInMainWorld('__E2E_CONTROLS__', e2eControls)
}

export type { SystemScopeApi } from '@shared/contracts/systemScope'
