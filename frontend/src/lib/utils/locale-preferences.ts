import { browser } from '$app/environment';
import { countryApi, type Country } from '$lib/api/country.api';
import { languageApi } from '$lib/api/language.api';
import { currencyStore, defaultCurrency, supportedCurrencies } from '$lib/stores/currency.store';
import { defaultLanguage, i18nStore } from '$lib/stores/i18n.store';

const LOCALE_PREFERENCE_MODE_KEY = 'localePreferenceMode';

export type LocalePreferenceMode = 'auto' | 'language' | 'region';

function normalizeCode(code: string | null | undefined): string | null {
  if (typeof code !== 'string') return null;
  const normalized = code.trim().toLowerCase();
  return normalized ? normalized : null;
}

function normalizeCountryCode(code: string | null | undefined): string | null {
  const normalized = normalizeCode(code);
  return normalized ? normalized.toUpperCase() : null;
}

function getBrowserLanguageCode(): string | null {
  if (!browser) return null;
  const browserLang = navigator.language || navigator.languages?.[0] || '';
  return normalizeCode(browserLang.split('-')[0]);
}

function getBrowserRegionCode(): string | null {
  if (!browser) return null;
  const browserLang = navigator.language || navigator.languages?.[0] || '';
  const region = browserLang.split('-')[1];
  return region ? region.toUpperCase() : null;
}

export function getLocalePreferenceMode(): LocalePreferenceMode {
  if (!browser) return 'auto';
  const stored = normalizeCode(localStorage.getItem(LOCALE_PREFERENCE_MODE_KEY));
  return stored === 'language' || stored === 'region' || stored === 'auto' ? stored : 'auto';
}

export function setLocalePreferenceMode(mode: LocalePreferenceMode): void {
  if (!browser) return;
  localStorage.setItem(LOCALE_PREFERENCE_MODE_KEY, mode);
}

export function resolveCountryForLanguage(
  languageCode: string,
  countries: Country[],
  browserLocale?: string
): Country | null {
  const lang = normalizeCode(languageCode);
  if (!lang || countries.length === 0) return null;

  const regionCode = browserLocale
    ? (browserLocale.split('-')[1]?.toUpperCase() ?? null)
    : getBrowserRegionCode();

  if (regionCode) {
    const byRegion = countries.find((country) => normalizeCountryCode(country.code) === regionCode);
    if (byRegion) return byRegion;
  }

  const byLanguage = countries.find((country) => normalizeCode(country.language) === lang);
  if (byLanguage) return byLanguage;

  if (lang === 'ru') {
    const ruCountry =
      countries.find((country) => normalizeCountryCode(country.code) === 'RU') ||
      countries.find((country) => normalizeCode(country.language) === 'ru') ||
      countries.find((country) => country.currency?.toUpperCase() === 'RUB');
    if (ruCountry) return ruCountry;
  }

  if (lang === 'en') {
    const enCountry =
      countries.find((country) => normalizeCountryCode(country.code) === 'US') ||
      countries.find((country) => normalizeCode(country.language) === 'en');
    if (enCountry) return enCountry;
  }

  return null;
}

/** Align header region country with selected checkout currency (e.g. RUB → RU for tax). */
export async function syncCountryCodeForCurrency(
  currency: string,
  countries?: Country[]
): Promise<void> {
  if (!browser) return;

  const normalizedCurrency = currency.trim().toUpperCase();
  if (!normalizedCurrency) return;

  let activeCountries = countries;
  if (!activeCountries?.length) {
    try {
      const response = await countryApi.getAll(true);
      activeCountries = response.countries ?? [];
    } catch (error) {
      console.error('Failed to load countries for currency sync:', error);
      return;
    }
  }

  const matches = activeCountries.filter(
    (country) => (country.currency || '').trim().toUpperCase() === normalizedCurrency
  );
  if (matches.length === 0) return;

  const storedCode = normalizeCountryCode(localStorage.getItem('selectedCountryCode'));
  const currentMatch = matches.find((country) => country.code === storedCode);
  const nextCountry = currentMatch ?? matches.find((country) => country.isDefault) ?? matches[0];

  localStorage.setItem('selectedCountryCode', nextCountry.code);
}

export async function applyCountrySelection(country: Country | null): Promise<void> {
  if (!browser) return;

  if (country) {
    localStorage.setItem('selectedCountryCode', country.code);
    const currency = country.currency?.trim().toUpperCase();
    const enabledCurrencies = currencyStore.getEnabledCurrencies();
    const fallbackCurrency = currencyStore.getDefaultCurrency();
    if (currency && enabledCurrencies.includes(currency)) {
      currencyStore.setCurrency(currency);
    } else {
      currencyStore.setCurrency(fallbackCurrency || defaultCurrency);
    }
  } else {
    localStorage.removeItem('selectedCountryCode');
    currencyStore.setCurrency(currencyStore.getDefaultCurrency() || defaultCurrency);
  }

  await currencyStore.loadCurrencyPreferences();
  await currencyStore.loadExchangeRates();
}

export async function syncCountryToLanguage(
  languageCode: string,
  countries: Country[],
  browserLocale?: string
): Promise<Country | null> {
  const matched = resolveCountryForLanguage(languageCode, countries, browserLocale);
  setLocalePreferenceMode('language');
  await applyCountrySelection(matched);
  return matched;
}

export async function applyLanguageSelection(
  languageCode: string,
  countries?: Country[],
  browserLocale?: string
): Promise<boolean> {
  const normalized = normalizeCode(languageCode);
  if (!normalized) return false;

  const changed = await i18nStore.setLanguage(normalized);
  if (!changed) return false;

  let activeCountries = countries;
  if (!activeCountries?.length) {
    try {
      const response = await countryApi.getAll(true);
      activeCountries = response.countries ?? [];
    } catch (error) {
      console.error('Failed to load countries for language locale sync:', error);
      return true;
    }
  }

  await syncCountryToLanguage(normalized, activeCountries, browserLocale);
  return true;
}

export async function initLocaleFromBrowser(): Promise<void> {
  if (!browser) return;

  try {
    const [activeLanguagesRes, activeCountriesRes, defaultLanguageRes] = await Promise.all([
      languageApi.getAll(true),
      countryApi.getAll(true),
      languageApi.getDefault(),
    ]);

    const activeLanguageCodes = (activeLanguagesRes.languages ?? []).map((language) =>
      language.code.toLowerCase()
    );
    i18nStore.setAllowedLanguages(activeLanguageCodes);

    const activeCountries = activeCountriesRes.countries ?? [];
    const storedLanguage = normalizeCode(localStorage.getItem('language'));
    const storedCountryCode = normalizeCountryCode(localStorage.getItem('selectedCountryCode'));
    const storedMode = getLocalePreferenceMode();
    const browserLanguage = getBrowserLanguageCode();
    const defaultCode = normalizeCode(defaultLanguageRes.language?.code) ?? defaultLanguage;

    const resolvedLanguage =
      (storedLanguage && activeLanguageCodes.includes(storedLanguage) && storedLanguage) ||
      (browserLanguage && activeLanguageCodes.includes(browserLanguage) && browserLanguage) ||
      (activeLanguageCodes.includes(defaultCode) && defaultCode) ||
      activeLanguageCodes[0] ||
      defaultLanguage;

    await i18nStore.setLanguage(resolvedLanguage);

    const storedCountry = storedCountryCode
      ? (activeCountries.find(
          (country) => normalizeCountryCode(country.code) === storedCountryCode
        ) ?? null)
      : null;
    const matchedCountry = resolveCountryForLanguage(
      resolvedLanguage,
      activeCountries,
      navigator.language
    );

    if (storedMode === 'region' && storedCountry) {
      setLocalePreferenceMode('region');
      await applyCountrySelection(storedCountry);
      return;
    }

    if (matchedCountry) {
      setLocalePreferenceMode('language');
      await applyCountrySelection(matchedCountry);
      return;
    }

    if (storedCountry) {
      setLocalePreferenceMode('region');
      await applyCountrySelection(storedCountry);
      return;
    }

    setLocalePreferenceMode('auto');
    await applyCountrySelection(null);
  } catch (error) {
    console.error('Failed to initialize locale preferences:', error);
  }
}
