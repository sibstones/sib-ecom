import { Request, Response } from 'express';
import { currencyRateService } from '../services/currency-rate.service';
import {
  currencyRateSettingsService,
  type CurrencyRateProvider,
} from '../services/currency-rate-settings.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class CurrencyRateController {
  /**
   * Get all currency rates
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const rates = await currencyRateService.getAll();
      res.json({ rates });
    } catch (error) {
      console.error('Error in getAll currency rates:', error);
      // Return empty array instead of error to prevent frontend crashes
      res.json({ rates: [] });
    }
  }

  /**
   * Get active currency rates (public endpoint)
   */
  async getActive(req: Request, res: Response): Promise<void> {
    try {
      const rates = await currencyRateService.getActive();
      res.json({ rates });
    } catch (error) {
      console.error('Error in getActive currency rates:', error);
      // Return default rates instead of error to prevent frontend crashes
      res.json({
        rates: {
          USD: 1.0,
          EUR: 0.92,
          GBP: 0.79,
          RUB: 92.5,
          JPY: 149.5,
          CNY: 7.2,
          KRW: 1330.0,
        },
      });
    }
  }

  /**
   * Get rate for specific currency
   */
  async getRate(req: Request, res: Response): Promise<void> {
    try {
      const { currency } = req.params;
      const rate = await currencyRateService.getRate(currency.toUpperCase());
      
      if (rate === null) {
        res.status(404).json({ error: `Currency rate not found for ${currency}` });
        return;
      }

      res.json({ currency: currency.toUpperCase(), rate });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get currency rate',
      });
    }
  }

  /**
   * Create or update currency rate
   */
  async upsert(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { currency, rateToUsd, isActive } = req.body;
      const updatedBy = req.user?.userId;

      if (!currency || rateToUsd === undefined) {
        res.status(400).json({ error: 'Currency and rateToUsd are required' });
        return;
      }

      const rate = await currencyRateService.upsert(
        {
          currency: currency.toUpperCase(),
          rateToUsd: Number(rateToUsd),
          isActive,
        },
        updatedBy
      );

      res.json({ rate });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to upsert currency rate',
      });
    }
  }

  /**
   * Update currency rate
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { currency } = req.params;
      const { rateToUsd, isActive } = req.body;
      const updatedBy = req.user?.userId;

      const rate = await currencyRateService.update(
        currency.toUpperCase(),
        {
          ...(rateToUsd !== undefined && { rateToUsd: Number(rateToUsd) }),
          ...(isActive !== undefined && { isActive }),
        },
        updatedBy
      );

      res.json({ rate });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update currency rate',
      });
    }
  }

  /**
   * Delete currency rate
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { currency } = req.params;
      await currencyRateService.delete(currency.toUpperCase());
      res.json({ message: 'Currency rate deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete currency rate',
      });
    }
  }

  /**
   * Convert amount between currencies
   */
  async convert(req: Request, res: Response): Promise<void> {
    try {
      const { amount, from, to } = req.query;

      if (!amount || !from || !to) {
        res.status(400).json({ error: 'amount, from, and to query parameters are required' });
        return;
      }

      const convertedAmount = await currencyRateService.convert(
        Number(amount),
        String(from).toUpperCase(),
        String(to).toUpperCase()
      );

      res.json({
        amount: Number(amount),
        from: String(from).toUpperCase(),
        to: String(to).toUpperCase(),
        convertedAmount,
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to convert currency',
      });
    }
  }

  /**
   * Get currency rate API settings (admin; API key masked)
   */
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await currencyRateSettingsService.getSettingsForAdmin();
      res.json(settings);
    } catch (error) {
      console.error('Error getting currency rate settings:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get currency rate settings',
      });
    }
  }

  /**
   * Update currency rate API settings (admin)
   */
  async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { provider, apiKey, baseUrl, autoUpdateEnabled } = req.body;
      const updatedBy = req.user?.userId;

      const data: {
        provider?: CurrencyRateProvider;
        apiKey?: string | null;
        baseUrl?: string | null;
        autoUpdateEnabled?: boolean;
      } = {};
      if (provider !== undefined) data.provider = provider as CurrencyRateProvider;
      if (apiKey !== undefined) data.apiKey = apiKey;
      if (baseUrl !== undefined) data.baseUrl = baseUrl;
      if (autoUpdateEnabled !== undefined) data.autoUpdateEnabled = Boolean(autoUpdateEnabled);

      await currencyRateSettingsService.updateSettings(data, updatedBy);
      const settings = await currencyRateSettingsService.getSettingsForAdmin();
      res.json(settings);
    } catch (error) {
      console.error('Error updating currency rate settings:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update currency rate settings',
      });
    }
  }

  /**
   * Fetch rates from external API and upsert (admin)
   */
  async fetchRates(req: AuthRequest, res: Response): Promise<void> {
    try {
      const updatedBy = req.user?.userId;
      const result = await currencyRateSettingsService.fetchRatesFromProvider(updatedBy);
      res.json({
        message: 'Currency rates updated from API',
        updated: result.updated,
        errors: result.errors,
      });
    } catch (error) {
      console.error('Error fetching currency rates from API:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to fetch currency rates from API',
      });
    }
  }
}

export const currencyRateController = new CurrencyRateController();
