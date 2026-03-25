import type { SystemScopeApi } from '@shared/contracts/systemScope'

interface WindowE2EMockControls {
  setUpdateAvailable: (value: boolean) => void
  reset: () => void
}

declare global {
  interface Window {
    systemScope: SystemScopeApi
    __E2E_LIGHTWEIGHT?: boolean
    __E2E_CONTROLS__?: WindowE2EMockControls
  }
}
