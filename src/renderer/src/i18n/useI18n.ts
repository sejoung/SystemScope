import { useCallback, useMemo } from 'react'
import { getLocaleTag, translate, type TranslationKey } from '@shared/i18n'
import { useSettingsStore } from '../stores/useSettingsStore'

export function useI18n() {
  const locale = useSettingsStore((state) => state.locale)
  const tk = useCallback(
    (input: string | TranslationKey, params?: Record<string, string | number>) =>
      translate(locale, input, params),
    [locale]
  )

  return useMemo(
    () => ({
      locale,
      localeTag: getLocaleTag(locale),
      tk
    }),
    [locale, tk]
  )
}
