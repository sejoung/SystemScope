import type { SystemScopeApi } from './index'

declare global {
  interface Window {
    systemScope: SystemScopeApi
  }
}
