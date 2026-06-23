import { Request, Response } from 'express';
import { loyaltyService } from '../services/loyalty.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class LoyaltyController {
  async getPoints(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const points = await loyaltyService.getPoints(req.user.userId);
      res.json({ points });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get loyalty points',
      });
    }
  }

  async spendPoints(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { points, orderId } = req.body;
      if (!points || points <= 0) {
        res.status(400).json({ error: 'Invalid points amount' });
        return;
      }

      const updated = await loyaltyService.spendPoints(req.user.userId, points, orderId);
      res.json({ points: updated });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to spend points',
      });
    }
  }

  async getConversionRate(req: Request, res: Response): Promise<void> {
    try {
      const rates = await loyaltyService.getRates();
      const dollars = await loyaltyService.pointsToDollars(100);
      res.json({
        pointsPerDollar: rates.earnPerUnit,
        pointsPerDollarDiscount: rates.spendPerUnit,
        example: {
          points: 100,
          dollars,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get conversion rate',
      });
    }
  }
}

export const loyaltyController = new LoyaltyController();
