import type { SystemScopeApi } from '@shared/contracts/systemScope'

declare global {
  interface Window {
    systemScope: SystemScopeApi
  }
}
