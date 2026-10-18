import { en, type Dictionary, type TranslationKey } from '../locales/en';
import { fr } from '../locales/fr';

export type { TranslationKey } from '../locales/en';

/** Languages the app can render, in UI order. */
export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const DICTIONARIES: Record<Language, Dictionary> = { en, fr };

/**
 * Normalize anything the client sent to a supported language.
 * Anything unknown falls back to English.
 */
export const resolveLanguage = (value: unknown): Language => (value === 'fr' ? 'fr' : 'en');

/**
 * Look up `key` in `language`, replacing `{name}` placeholders with `params`.
 * Falls back to English, then to the key itself — a missing translation must
 * never crash PDF rendering.
 */
export const t = (
  key: TranslationKey,
  language: Language,
  params?: Record<string, string | number>,
): string => {
  let text: string = DICTIONARIES[language][key] ?? en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
};
