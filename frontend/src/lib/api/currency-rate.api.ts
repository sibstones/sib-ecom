import { apiClient } from './client';

export interface CurrencyRate {
  currency: string;
  rateToUsd: number;
  isActive: boolean;
}

export interface ConvertCurrencyResponse {
  amount: number;
  from: string;
  to: string;
  convertedAmount: number;
}

export type CurrencyRateProvider = 'EXCHANGERATE_API' | 'FIXER' | 'OPEN_EXCHANGE_RATES';

export interface CurrencyRateSettings {
  provider: CurrencyRateProvider;
  apiKey: string | null;
  baseUrl: string | null;
  autoUpdateEnabled: boolean;
  apiKeyMasked?: boolean;
}

export const currencyRateApi = {
  getAll: (options?: RequestInit) =>
    apiClient.get<{ rates: CurrencyRate[] }>('/currency-rates', options),
  getActive: () => apiClient.get<{ rates: Record<string, number> }>('/currency-rates/active'),
  getRate: (currency: string) =>
    apiClient.get<{ currency: string; rate: number }>(`/currency-rates/${currency}`),
  convert: (amount: number, from: string, to: string) =>
    apiClient.get<ConvertCurrencyResponse>('/currency-rates/convert', {
      params: { amount, from, to },
    }),
  upsert: (data: { currency: string; rateToUsd: number; isActive?: boolean }) =>
    apiClient.post<{ rate: CurrencyRate }>('/currency-rates', data),
  update: (currency: string, data: { rateToUsd?: number; isActive?: boolean }) =>
    apiClient.put<{ rate: CurrencyRate }>(`/currency-rates/${currency}`, data),
  delete: (currency: string) =>
    apiClient.delete<{ message: string }>(`/currency-rates/${currency}`),

  getSettings: () => apiClient.get<CurrencyRateSettings>('/currency-rates/settings'),
  updateSettings: (data: Partial<CurrencyRateSettings> & { apiKey?: string | null }) =>
    apiClient.put<CurrencyRateSettings>('/currency-rates/settings', data),
  fetchRates: () =>
    apiClient.post<{ message: string; updated: number; errors?: string[] }>(
      '/currency-rates/fetch'
    ),
};
