import type { SystemScopeApi } from '@shared/contracts/systemScope'

declare global {
  interface WindowE2EMockControls {
    setUpdateAvailable: (value: boolean) => void
    reset: () => void
  }

  interface Window {
    systemScope: SystemScopeApi
    __E2E_LIGHTWEIGHT?: boolean
    __E2E_CONTROLS__?: WindowE2EMockControls
  }
}

export {}
