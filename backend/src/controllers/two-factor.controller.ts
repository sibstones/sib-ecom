import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { twoFactorService } from '../services/two-factor.service';

export class TwoFactorController {
  async startSetup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const result = await twoFactorService.startSetup(req.user.userId);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to start two-factor setup',
      });
    }
  }

  async confirmSetup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const code = (req.body as { code?: string })?.code;
      if (!code || typeof code !== 'string') {
        res.status(400).json({ error: 'Code is required' });
        return;
      }
      await twoFactorService.confirmSetup(req.user.userId, code);
      res.json({ message: 'Two-factor authentication enabled' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to confirm two-factor setup',
      });
    }
  }

  async cancelSetup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      await twoFactorService.cancelSetup(req.user.userId);
      res.json({ message: 'Two-factor setup cancelled' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to cancel setup',
      });
    }
  }

  async disable(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const body = req.body as { password?: string; code?: string };
      if (!body.password || !body.code) {
        res.status(400).json({ error: 'Password and authentication code are required' });
        return;
      }
      await twoFactorService.disable(req.user.userId, body.password, body.code);
      res.json({ message: 'Two-factor authentication disabled' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to disable two-factor authentication',
      });
    }
  }
}

export const twoFactorController = new TwoFactorController();
