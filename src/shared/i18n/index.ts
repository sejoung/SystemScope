import { EN_MESSAGES, type TranslationKey } from './locales/en'
import { KO_MESSAGES } from './locales/ko'

export type AppLocale = 'ko' | 'en'

export type TranslationParams = Record<string, string | number>
export type TranslateFn = (input: string | TranslationKey, params?: TranslationParams) => string

type Params = TranslationParams
type LocaleMessages = Record<string, string>

const EN_LOOKUP = EN_MESSAGES as LocaleMessages
const KO_LOOKUP = KO_MESSAGES as LocaleMessages

const TO_EN = new Map<string, string>()
const TO_KO = new Map<string, string>()

for (const [english, korean] of Object.entries(EN_LOOKUP).map(([key, value]) => [value, KO_LOOKUP[key]] as const)) {
  TO_EN.set(english, english)
  TO_EN.set(korean, english)
  TO_KO.set(english, korean)
  TO_KO.set(korean, korean)
}

export function translate(locale: AppLocale, input: string | TranslationKey, params?: Params): string {
  const source = EN_LOOKUP[input] ?? input
  const translated = (locale === 'ko' ? TO_KO : TO_EN).get(source) ?? source
  if (!params) return translated

  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    translated
  )
}

export function getLocaleTag(locale: AppLocale): string {
  return locale === 'ko' ? 'ko-KR' : 'en-US'
}

export type { TranslationKey }
