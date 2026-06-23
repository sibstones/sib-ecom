import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { currencyRateApi } from '../api/currency-rate.api';
import { settingsApi } from '../api/settings.api';

export const supportedCurrencies = ['USD', 'EUR', 'GBP', 'RUB', 'JPY', 'CNY', 'KRW'];
export const defaultCurrency = 'USD';

// Default exchange rates (fallback if API is not available)
const defaultExchangeRates: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  RUB: 92.5,
  JPY: 149.5,
  CNY: 7.2,
  KRW: 1330.0,
};

/**
 * Round price to make it look nice
 * Rules:
 * - For RUB: round to nearest 10 (e.g., 1250 -> 1250, 1253 -> 1250, 1257 -> 1260)
 * - For JPY, KRW: round to nearest 10
 * - For EUR, GBP, CNY: round to 2 decimal places
 * - For USD: round to 2 decimal places
 */
function roundPrice(amount: number, currency: string): number {
  // Round to nearest 10 for RUB, JPY, KRW
  if (['RUB', 'JPY', 'KRW'].includes(currency)) {
    return Math.round(amount / 10) * 10;
  }

  // Round to 2 decimal places for others
  return Math.round(amount * 100) / 100;
}

const createCurrencyStore = () => {
  const { subscribe, set, update } = writable<string>(defaultCurrency);
  const exchangeRates = writable<Record<string, number>>(defaultExchangeRates);
  const enabledCurrencies = writable<string[]>(supportedCurrencies);
  const configuredDefaultCurrency = writable<string>(defaultCurrency);

  async function loadCurrencyPreferences() {
    if (!browser) return;

    try {
      const response = await settingsApi.getAll();
      const rawEnabled = Array.isArray(response.settings.storeCurrencies)
        ? response.settings.storeCurrencies
        : supportedCurrencies;
      const normalizedEnabled = rawEnabled
        .map((currency) =>
          String(currency || '')
            .trim()
            .toUpperCase()
        )
        .filter(
          (currency, index, arr) =>
            supportedCurrencies.includes(currency) && arr.indexOf(currency) === index
        );
      const nextEnabled = normalizedEnabled.length > 0 ? normalizedEnabled : supportedCurrencies;
      const rawDefault = String(response.settings.defaultStoreCurrency || '')
        .trim()
        .toUpperCase();
      const nextDefault = nextEnabled.includes(rawDefault)
        ? rawDefault
        : nextEnabled[0] || defaultCurrency;

      enabledCurrencies.set(nextEnabled);
      configuredDefaultCurrency.set(nextDefault);

      const stored = localStorage.getItem('currency');
      const nextCurrent = stored && nextEnabled.includes(stored) ? stored : nextDefault;
      set(nextCurrent);
      localStorage.setItem('currency', nextCurrent);
    } catch (error) {
      console.warn('Failed to load currency preferences, using defaults:', error);
      enabledCurrencies.set(supportedCurrencies);
      configuredDefaultCurrency.set(defaultCurrency);
    }
  }

  // Load exchange rates from API
  async function loadExchangeRates() {
    if (!browser) return;

    try {
      const response = await currencyRateApi.getActive();
      exchangeRates.set(response.rates);
    } catch (error) {
      console.warn('Failed to load exchange rates, using defaults:', error);
      // Use default rates if API fails (e.g., table doesn't exist yet)
      exchangeRates.set(defaultExchangeRates);
    }
  }

  // Load from localStorage on init
  if (browser) {
    loadCurrencyPreferences();
    // Load exchange rates
    loadExchangeRates();
  }

  return {
    subscribe,
    setCurrency: (currency: string) => {
      let allowedCurrencies = supportedCurrencies;
      enabledCurrencies.subscribe((list) => {
        allowedCurrencies = list;
      })();
      if (!allowedCurrencies.includes(currency)) return;
      set(currency);
      if (browser) {
        localStorage.setItem('currency', currency);
      }
    },
    convert: (
      amount: number,
      from: string,
      to: string,
      ratesOverride?: Record<string, number>
    ): number => {
      if (from === to) {
        return roundPrice(amount, to);
      }

      // Use override rates if provided, otherwise get from store
      let rates: Record<string, number> = ratesOverride || defaultExchangeRates;

      if (!ratesOverride) {
        // Get current rates from store synchronously
        exchangeRates.subscribe((r) => {
          rates = r;
        })();
      }

      const fromRate = rates[from] || 1;
      const toRate = rates[to] || 1;
      const usdAmount = amount / fromRate;
      const convertedAmount = usdAmount * toRate;

      return roundPrice(convertedAmount, to);
    },
    format: (amount: number, currency: string): string => {
      const formatters: Record<string, Intl.NumberFormat> = {
        USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
        EUR: new Intl.NumberFormat('en-EU', { style: 'currency', currency: 'EUR' }),
        GBP: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
        RUB: new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }),
        JPY: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }),
        CNY: new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }),
        KRW: new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }),
      };

      const formatter = formatters[currency] || formatters[defaultCurrency];
      return formatter.format(amount);
    },
    loadExchangeRates,
    loadCurrencyPreferences,
    getExchangeRates: (): Record<string, number> => {
      let rates: Record<string, number> = defaultExchangeRates;
      const unsubscribe = exchangeRates.subscribe((r) => {
        rates = r;
      });
      unsubscribe();
      return rates;
    },
    getEnabledCurrencies: (): string[] => {
      let currencies = supportedCurrencies;
      const unsubscribe = enabledCurrencies.subscribe((list) => {
        currencies = list;
      });
      unsubscribe();
      return currencies;
    },
    getDefaultCurrency: (): string => {
      let currency = defaultCurrency;
      const unsubscribe = configuredDefaultCurrency.subscribe((value) => {
        currency = value;
      });
      unsubscribe();
      return currency;
    },
    subscribeRates: exchangeRates.subscribe,
    subscribeEnabledCurrencies: enabledCurrencies.subscribe,
  };
};

export const currencyStore = createCurrencyStore();
export const enabledCurrenciesStore = {
  subscribe: currencyStore.subscribeEnabledCurrencies,
};
