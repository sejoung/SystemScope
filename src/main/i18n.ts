import { translate, type AppLocale, type TranslationKey } from '@shared/i18n'

export function getCurrentLocale(): AppLocale {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSettings } = require('./store/settingsStore') as typeof import('./store/settingsStore')
    const locale = getSettings().locale
    return locale === 'ko' ? 'ko' : 'en'
  } catch {
    return 'en'
  }
}

export function tk(text: string, params?: Record<string, string | number>): string
export function tk(key: TranslationKey, params?: Record<string, string | number>): string
export function tk(input: string | TranslationKey, params?: Record<string, string | number>): string {
  return translate(getCurrentLocale(), input, params)
}
