import { getLocaleTag, translate, translateKey, type TranslationKey } from '@shared/i18n'
import { useSettingsStore } from '../stores/useSettingsStore'

export function useI18n() {
  const locale = useSettingsStore((state) => state.locale)

  return {
    locale,
    localeTag: getLocaleTag(locale),
    t: (text: string, params?: Record<string, string | number>) => translate(locale, text, params),
    tk: (key: TranslationKey, params?: Record<string, string | number>) => translateKey(locale, key, params)
  }
}
