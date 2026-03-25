import { useCallback, useMemo } from 'react'
import { getLocaleTag, translate, translateKey, type TranslationKey } from '@shared/i18n'
import { useSettingsStore } from '../stores/useSettingsStore'

export function useI18n() {
  const locale = useSettingsStore((state) => state.locale)
  const t = useCallback(
    (text: string, params?: Record<string, string | number>) =>
      translate(locale, text, params),
    [locale]
  )
  const tk = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translateKey(locale, key, params),
    [locale]
  )

  return useMemo(
    () => ({
      locale,
      localeTag: getLocaleTag(locale),
      t,
      tk
    }),
    [locale, t, tk]
  )
}
