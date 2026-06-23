import prisma from '../config/database';
import { supportedCurrencies } from '../config/currency';
import { currencyRateService } from './currency-rate.service';

export type CurrencyRateProvider = 'EXCHANGERATE_API' | 'FIXER' | 'OPEN_EXCHANGE_RATES';

export interface CurrencyRateSettingsDto {
  provider: CurrencyRateProvider;
  apiKey: string | null;
  baseUrl: string | null;
  autoUpdateEnabled: boolean;
}

const DEFAULT_SETTINGS: CurrencyRateSettingsDto = {
  provider: 'EXCHANGERATE_API',
  apiKey: null,
  baseUrl: null,
  autoUpdateEnabled: false,
};

/** ExchangeRate-API v6: GET /v6/{key}/latest/USD -> conversion_rates */
const EXCHANGERATE_API_URL = 'https://v6.exchangerate-api.com/v6';

export class CurrencyRateSettingsService {
  async getSettings(): Promise<CurrencyRateSettingsDto> {
    const row = await prisma.currencyRateSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!row) {
      return { ...DEFAULT_SETTINGS };
    }
    return {
      provider: row.provider as CurrencyRateProvider,
      apiKey: row.apiKey ?? null,
      baseUrl: row.baseUrl ?? null,
      autoUpdateEnabled: row.autoUpdateEnabled,
    };
  }

  /** Returns settings for API; apiKey is masked in responses to frontend (only show if set: "••••••••") */
  async getSettingsForAdmin(): Promise<CurrencyRateSettingsDto & { apiKeyMasked?: boolean }> {
    const row = await prisma.currencyRateSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!row) {
      return { ...DEFAULT_SETTINGS, apiKeyMasked: false };
    }
    return {
      provider: row.provider as CurrencyRateProvider,
      apiKey: row.apiKey ? '••••••••' : null,
      baseUrl: row.baseUrl ?? null,
      autoUpdateEnabled: row.autoUpdateEnabled,
      apiKeyMasked: !!row.apiKey,
    };
  }

  async updateSettings(
    data: Partial<Omit<CurrencyRateSettingsDto, 'apiKey'> & { apiKey?: string | null }>,
    updatedBy?: string
  ): Promise<CurrencyRateSettingsDto> {
    const existing = await prisma.currencyRateSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    type UpdatePayload = {
      provider: string;
      baseUrl: string | null;
      autoUpdateEnabled: boolean;
      updatedAt: Date;
      updatedBy: string | null;
      apiKey?: string | null;
    };
    const payload: UpdatePayload = {
      provider: data.provider ?? existing?.provider ?? DEFAULT_SETTINGS.provider,
      baseUrl: data.baseUrl !== undefined ? data.baseUrl : existing?.baseUrl ?? null,
      autoUpdateEnabled: data.autoUpdateEnabled ?? existing?.autoUpdateEnabled ?? false,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };
    if (data.apiKey !== undefined && data.apiKey !== '••••••••') {
      payload.apiKey = data.apiKey === '' || data.apiKey === null ? null : data.apiKey;
    } else if (existing?.apiKey) {
      payload.apiKey = existing.apiKey;
    }

    if (existing) {
      await prisma.currencyRateSettings.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      await prisma.currencyRateSettings.create({
        data: {
          id: crypto.randomUUID(),
          ...payload,
        },
      });
    }

    return this.getSettings();
  }

  /**
   * Fetch rates from configured provider and upsert into currency_rates.
   * Only currencies in supportedCurrencies are upserted; USD is always 1.0.
   */
  async fetchRatesFromProvider(updatedBy?: string): Promise<{ updated: number; errors?: string[] }> {
    const settings = await this.getSettings();
    if (!settings.apiKey?.trim()) {
      throw new Error('Currency rate API key is not configured. Set it in Currency Rate Settings.');
    }

    const provider = (settings.provider || 'EXCHANGERATE_API') as CurrencyRateProvider;
    let ratesMap: Record<string, number>;

    if (provider === 'EXCHANGERATE_API') {
      ratesMap = await this.fetchFromExchangerateApi(settings.apiKey.trim(), settings.baseUrl);
    } else if (provider === 'FIXER') {
      ratesMap = await this.fetchFromFixer(settings.apiKey.trim(), settings.baseUrl);
    } else if (provider === 'OPEN_EXCHANGE_RATES') {
      ratesMap = await this.fetchFromOpenExchangeRates(settings.apiKey.trim(), settings.baseUrl);
    } else {
      throw new Error(`Unsupported currency rate provider: ${provider}`);
    }

    const toUpsert = supportedCurrencies.filter((c) => c !== 'USD' && ratesMap[c] != null);
    const errors: string[] = [];
    let updated = 0;

    for (const currency of toUpsert) {
      const rateToUsd = ratesMap[currency];
      if (typeof rateToUsd !== 'number' || rateToUsd <= 0) continue;
      try {
        await currencyRateService.upsert(
          { currency, rateToUsd, isActive: true },
          updatedBy
        );
        updated += 1;
      } catch (e) {
        errors.push(`${currency}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Ensure USD exists
    try {
      await currencyRateService.upsert(
        { currency: 'USD', rateToUsd: 1.0, isActive: true },
        updatedBy
      );
      updated += 1;
    } catch {
      // ignore
    }

    return { updated, errors: errors.length ? errors : undefined };
  }

  private async fetchFromExchangerateApi(apiKey: string, baseUrl?: string | null): Promise<Record<string, number>> {
    const base = (baseUrl || EXCHANGERATE_API_URL).replace(/\/$/, '');
    const url = `${base}/${apiKey}/latest/USD`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ExchangeRate-API error ${res.status}: ${text || res.statusText}`);
    }
    const json = (await res.json()) as {
      result?: string;
      conversion_rates?: Record<string, number>;
    };
    if (json.result !== 'success' || !json.conversion_rates || typeof json.conversion_rates !== 'object') {
      throw new Error('ExchangeRate-API invalid response: missing conversion_rates');
    }
    return json.conversion_rates;
  }

  private async fetchFromFixer(apiKey: string, baseUrl?: string | null): Promise<Record<string, number>> {
    const base = (baseUrl || 'https://data.fixer.io/api').replace(/\/$/, '');
    const url = `${base}/latest?access_key=${encodeURIComponent(apiKey)}&base=USD`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fixer API error ${res.status}: ${text || res.statusText}`);
    }
    const json = (await res.json()) as { rates?: Record<string, number>; success?: boolean };
    if (!json.rates || typeof json.rates !== 'object') {
      throw new Error('Fixer API invalid response: missing rates');
    }
    return { USD: 1, ...json.rates };
  }

  private async fetchFromOpenExchangeRates(apiKey: string, baseUrl?: string | null): Promise<Record<string, number>> {
    const base = (baseUrl || 'https://openexchangerates.org/api').replace(/\/$/, '');
    const url = `${base}/latest.json?app_id=${encodeURIComponent(apiKey)}&base=USD`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Open Exchange Rates error ${res.status}: ${text || res.statusText}`);
    }
    const json = (await res.json()) as { rates?: Record<string, number> };
    if (!json.rates || typeof json.rates !== 'object') {
      throw new Error('Open Exchange Rates invalid response: missing rates');
    }
    return { USD: 1, ...json.rates };
  }
}

export const currencyRateSettingsService = new CurrencyRateSettingsService();
