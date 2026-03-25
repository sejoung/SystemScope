import type { SystemScopeApi } from '@shared/contracts/systemScope'

declare global {
  interface Window {
    systemScope: SystemScopeApi
    __E2E_LIGHTWEIGHT?: boolean
  }
}
