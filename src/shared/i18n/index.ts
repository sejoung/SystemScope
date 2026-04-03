import { EN_MESSAGES } from './locales/en'
import { KO_MESSAGES } from './locales/ko'
import { MESSAGE_KEYS, type TranslationKey } from './keys'

export type AppLocale = 'ko' | 'en'

type Params = Record<string, string | number>
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
  const source = resolveTranslationInput(input)
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

function resolveTranslationInput(input: string | TranslationKey): string {
  const keyed = (MESSAGE_KEYS as Record<string, string>)[input]
  return keyed ?? input
}

export type { TranslationKey }
