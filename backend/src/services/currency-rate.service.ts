import prisma from '../config/database';
import { Prisma } from '@prisma/client';

export interface CurrencyRateDto {
  currency: string;
  rateToUsd: number;
  isActive?: boolean;
}

export interface UpdateCurrencyRateDto {
  rateToUsd?: number;
  isActive?: boolean;
}

export class CurrencyRateService {
  /**
   * Get all currency rates
   */
  async getAll(): Promise<CurrencyRateDto[]> {
    try {
      // Check if currencyRate model exists in Prisma Client
      if (!prisma.currencyRate) {
        console.warn('CurrencyRate model not found in Prisma Client. Please restart the server after running migrations.');
        return [];
      }

      const rates = await prisma.currencyRate.findMany({
        orderBy: { currency: 'asc' },
      });

      return rates.map((rate) => ({
        currency: rate.currency,
        rateToUsd: Number(rate.rateToUsd),
        isActive: rate.isActive,
      }));
    } catch (error) {
      // If table doesn't exist yet or model not found, return empty array
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('does not exist') || errorMessage.includes('Unknown model') || errorMessage.includes('undefined')) {
        console.warn('CurrencyRate table/model not available. Run migrations and restart server.');
        return [];
      }
      console.error('Error fetching currency rates:', error);
      throw error;
    }
  }

  /**
   * Get active currency rates only
   */
  async getActive(): Promise<Record<string, number>> {
    try {
      // Check if currencyRate model exists in Prisma Client
      if (!prisma.currencyRate) {
        console.warn('CurrencyRate model not found in Prisma Client. Using default rates.');
        return {
          USD: 1.0,
          EUR: 0.92,
          GBP: 0.79,
          RUB: 92.5,
          JPY: 149.5,
          CNY: 7.2,
          KRW: 1330.0,
        };
      }

      const rates = await prisma.currencyRate.findMany({
        where: { isActive: true },
      });

      const ratesMap: Record<string, number> = {};
      rates.forEach((rate) => {
        ratesMap[rate.currency] = Number(rate.rateToUsd);
      });

      // Always include USD with rate 1.0
      ratesMap['USD'] = 1.0;

      return ratesMap;
    } catch (error) {
      // If table doesn't exist yet or model not found, return default rates
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('does not exist') || errorMessage.includes('Unknown model') || errorMessage.includes('undefined')) {
        console.warn('CurrencyRate table/model not available. Using default rates.');
        return {
          USD: 1.0,
          EUR: 0.92,
          GBP: 0.79,
          RUB: 92.5,
          JPY: 149.5,
          CNY: 7.2,
          KRW: 1330.0,
        };
      }
      console.error('Error fetching active currency rates:', error);
      throw error;
    }
  }

  /**
   * Get rate for specific currency
   */
  async getRate(currency: string): Promise<number | null> {
    if (currency === 'USD') {
      return 1.0;
    }

    try {
      const rate = await prisma.currencyRate.findUnique({
        where: { currency },
      });

      if (!rate || !rate.isActive) {
        return null;
      }

      return Number(rate.rateToUsd);
    } catch (error) {
      // If table doesn't exist yet, return null
      if (error instanceof Error && error.message.includes('does not exist')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update currency rate
   */
  async upsert(
    data: CurrencyRateDto,
    updatedBy?: string
  ): Promise<CurrencyRateDto> {
    try {
      const rate = await prisma.currencyRate.upsert({
        where: { currency: data.currency },
        update: {
          rateToUsd: new Prisma.Decimal(data.rateToUsd),
          isActive: data.isActive ?? true,
          updatedBy,
        },
        create: {
          currency: data.currency,
          rateToUsd: new Prisma.Decimal(data.rateToUsd),
          isActive: data.isActive ?? true,
          updatedBy,
        },
      });

      return {
        currency: rate.currency,
        rateToUsd: Number(rate.rateToUsd),
        isActive: rate.isActive,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        throw new Error('CurrencyRate table does not exist. Please run migrations.');
      }
      throw error;
    }
  }

  /**
   * Update currency rate
   */
  async update(
    currency: string,
    data: UpdateCurrencyRateDto,
    updatedBy?: string
  ): Promise<CurrencyRateDto> {
    const rate = await prisma.currencyRate.update({
      where: { currency },
      data: {
        ...(data.rateToUsd !== undefined && {
          rateToUsd: new Prisma.Decimal(data.rateToUsd),
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedBy,
      },
    });

    return {
      currency: rate.currency,
      rateToUsd: Number(rate.rateToUsd),
      isActive: rate.isActive,
    };
  }

  /**
   * Delete currency rate
   */
  async delete(currency: string): Promise<void> {
    await prisma.currencyRate.delete({
      where: { currency },
    });
  }

  /**
   * Convert using a fixed rate map (e.g. snapshot at checkout). Keys are ISO codes; values match `getActive()` (rateToUsd).
   */
  convertWithRatesMap(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    rates: Record<string, number>
  ): number {
    const from = fromCurrency.trim().toUpperCase();
    const to = toCurrency.trim().toUpperCase();
    if (from === to) {
      return this.roundPrice(amount, to);
    }
    const fromRate = rates[from] ?? (from === 'USD' ? 1 : undefined);
    const toRate = rates[to] ?? (to === 'USD' ? 1 : undefined);
    if (fromRate == null || toRate == null || fromRate === 0) {
      throw new Error(`Missing or invalid rate in map for ${from} or ${to}`);
    }
    const usdAmount = amount / fromRate;
    const converted = usdAmount * toRate;
    return this.roundPrice(converted, to);
  }

  /**
   * Convert amount from one currency to another with rounding
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return this.roundPrice(amount, toCurrency);
    }

    try {
      // Get rates
      const fromRate = await this.getRate(fromCurrency);
      const toRate = await this.getRate(toCurrency);

      if (fromRate === null || toRate === null) {
        throw new Error(`Currency rate not found for ${fromCurrency} or ${toCurrency}`);
      }

      // Convert to USD first, then to target currency
      const usdAmount = amount / fromRate;
      const convertedAmount = usdAmount * toRate;

      return this.roundPrice(convertedAmount, toCurrency);
    } catch (error) {
      // If table doesn't exist, use default rates for conversion
      if (error instanceof Error && error.message.includes('does not exist')) {
        const defaultRates: Record<string, number> = {
          USD: 1.0,
          EUR: 0.92,
          GBP: 0.79,
          RUB: 92.5,
          JPY: 149.5,
          CNY: 7.2,
          KRW: 1330.0,
        };
        
        const fromRate = defaultRates[fromCurrency] || 1;
        const toRate = defaultRates[toCurrency] || 1;
        const usdAmount = amount / fromRate;
        const convertedAmount = usdAmount * toRate;
        
        return this.roundPrice(convertedAmount, toCurrency);
      }
      throw error;
    }
  }

  /**
   * Round price to make it look nice
   * Rules:
   * - For RUB: round to nearest 10 (e.g., 1250 -> 1250, 1253 -> 1250, 1257 -> 1260)
   * - For JPY, KRW: round to nearest 10
   * - For EUR, GBP, CNY: round to 2 decimal places
   * - For USD: round to 2 decimal places
   */
  private roundPrice(amount: number, currency: string): number {
    // Round to nearest 10 for RUB, JPY, KRW
    if (['RUB', 'JPY', 'KRW'].includes(currency)) {
      return Math.round(amount / 10) * 10;
    }

    // Round to 2 decimal places for others
    return Math.round(amount * 100) / 100;
  }
}

export const currencyRateService = new CurrencyRateService();
