import { en } from './i18n/en';

type TranslationDict = Record<string, string>;

const translations: Record<string, TranslationDict> = {
  en,
};

const loadCache: Partial<Record<string, Promise<TranslationDict>>> = {};

const localeLoaders: Record<string, () => Promise<TranslationDict>> = {
  ru: () => import('./i18n/ru').then((mod) => mod.ru),
  fr: () => import('./i18n/fr').then((mod) => mod.fr),
  de: () => import('./i18n/de').then((mod) => mod.de),
  es: () => import('./i18n/es').then((mod) => mod.es),
  ja: () => import('./i18n/ja').then((mod) => mod.ja),
  zh: () => import('./i18n/zh').then((mod) => mod.zh),
  ko: () => import('./i18n/ko').then((mod) => mod.ko),
  ar: () => import('./i18n/ar').then((mod) => mod.ar),
  hi: () => import('./i18n/hi').then((mod) => mod.hi),
  it: () => import('./i18n/it').then((mod) => mod.it),
  nl: () => import('./i18n/nl').then((mod) => mod.nl),
  pl: () => import('./i18n/pl').then((mod) => mod.pl),
  pt: () => import('./i18n/pt').then((mod) => mod.pt),
};

export function getLoadedTranslations(): Record<string, TranslationDict> {
  return translations;
}

export function getTranslation(languageCode: string, key: string): string {
  return translations[languageCode]?.[key] || translations.en[key] || key;
}

export async function ensureLanguageLoaded(languageCode: string): Promise<TranslationDict> {
  const normalized = languageCode.toLowerCase().trim();
  if (!normalized) return translations.en;

  if (translations[normalized]) {
    return translations[normalized];
  }

  const loader = localeLoaders[normalized];
  if (!loader) {
    return translations.en;
  }

  if (!loadCache[normalized]) {
    loadCache[normalized] = loader().then((dict) => {
      translations[normalized] = dict;
      return dict;
    });
  }

  return loadCache[normalized]!;
}
