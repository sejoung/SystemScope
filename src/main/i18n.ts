import { translateLiteral, translateKey, type AppLocale, type TranslationKey } from '@shared/i18n'

export function getCurrentLocale(): AppLocale {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSettings } = require('./store/settingsStore') as typeof import('./store/settingsStore')
    const locale = getSettings().locale
    return locale === 'en' ? 'en' : 'ko'
  } catch {
    return 'ko'
  }
}

export function t(text: string, params?: Record<string, string | number>): string {
  return translateLiteral(getCurrentLocale(), text, params)
}

export function tk(key: TranslationKey, params?: Record<string, string | number>): string {
  return translateKey(getCurrentLocale(), key, params)
}
