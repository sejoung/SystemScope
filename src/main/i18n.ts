import { translate, type AppLocale, type TranslateFn } from '@shared/i18n'

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

export const tk: TranslateFn = (input, params) => {
  return translate(getCurrentLocale(), input, params)
}
