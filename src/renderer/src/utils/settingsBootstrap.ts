import type { AppSettings } from '@shared/types'
import type { SystemScopeAboutInfo } from '@shared/contracts/systemScope'
import { useSettingsStore } from '../stores/useSettingsStore'
import { reportRendererError } from './rendererLogging'

export function applySettingsToStore(settings: AppSettings): void {
  const state = useSettingsStore.getState()
  state.setThresholds(settings.thresholds)
  state.setTheme(settings.theme)
  state.setLocale(settings.locale)
}

export async function loadAppSettings(scope: string): Promise<AppSettings | null> {
  try {
    const result = await window.systemScope.getSettings()
    if (!result.ok) {
      await reportRendererError(scope, 'Failed to load settings', {
        error: result.error
      })
      return null
    }

    return result.data ?? null
  } catch (error) {
    await reportRendererError(scope, 'Failed to load settings', { error })
    return null
  }
}

export async function loadAboutInfo(scope: string): Promise<SystemScopeAboutInfo | null> {
  try {
    const result = await window.systemScope.getAboutInfo()
    if (!result.ok) {
      await reportRendererError(scope, 'Failed to load about info', {
        error: result.error
      })
      return null
    }

    return result.data ?? null
  } catch (error) {
    await reportRendererError(scope, 'Failed to load about info', { error })
    return null
  }
}

export async function loadPathValue(
  scope: string,
  label: 'dataPath' | 'systemLogPath' | 'accessLogPath',
  loader: () => Promise<{ ok: boolean; data?: string; error?: unknown }>
): Promise<string | null> {
  try {
    const result = await loader()
    if (!result.ok || !result.data) {
      await reportRendererError(scope, `Failed to load ${label}`, {
        error: result.error
      })
      return null
    }

    return result.data
  } catch (error) {
    await reportRendererError(scope, `Failed to load ${label}`, { error })
    return null
  }
}
