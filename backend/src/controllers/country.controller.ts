import { Request, Response } from 'express';
import { countryService } from '../services/country.service';
import { CreateCountryDto, UpdateCountryDto } from '../types/country';
import { AuthRequest } from '../middleware/auth.middleware';

export class CountryController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const countries = await countryService.getAll(activeOnly);
      res.json({ countries });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get countries',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const country = await countryService.getById(id);
      if (!country) {
        res.status(404).json({ error: 'Country not found' });
        return;
      }
      res.json({ country });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get country',
      });
    }
  }

  async getDefault(req: Request, res: Response): Promise<void> {
    try {
      const country = await countryService.getDefault();
      res.json({ country });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get default country',
      });
    }
  }

  /** Public: get checkout estimate (tax, shipping, total) in USD; optional displayCurrency for PSP-aligned preview */
  async getCheckoutEstimate(req: Request, res: Response): Promise<void> {
    try {
      const countryCode = (req.query.countryCode as string) || 'US';
      const subtotal = parseFloat(req.query.subtotal as string) || 0;
      const discount = parseFloat(req.query.discount as string) || 0;
      const loyaltyDiscount = parseFloat(req.query.loyaltyDiscount as string) || 0;
      const displayCurrency =
        typeof req.query.displayCurrency === 'string' ? req.query.displayCurrency : undefined;
      const { customerService } = await import('../services/customer.service');
      const estimate = await customerService.getCheckoutEstimate(
        countryCode,
        subtotal,
        discount,
        displayCurrency,
        loyaltyDiscount
      );
      res.json(estimate);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get checkout estimate',
      });
    }
  }

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = req.body as CreateCountryDto;
      const country = await countryService.create(data);
      res.status(201).json({ country });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create country',
      });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateCountryDto;
      const country = await countryService.update(id, data);
      res.json({ country });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update country',
      });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await countryService.delete(id);
      res.json({ message: 'Country deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete country',
      });
    }
  }

  async setDefault(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const country = await countryService.setDefault(id);
      res.json({ country });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to set default country',
      });
    }
  }
}

export const countryController = new CountryController();
