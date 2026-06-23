import { Request, Response } from 'express';
import { headerService } from '../services/header.service';
import { UpdateHeaderSettingsDto } from '../types/header';
import { AuthRequest } from '../middleware/auth.middleware';

export class HeaderController {
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await headerService.getSettings();
      res.json({ settings });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Header] getSettings failed:', err.message, err.stack);
      res.status(500).json({
        error: err.message || 'Failed to get header settings',
      });
    }
  }

  async getActiveSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await headerService.getActiveSettings();
      res.json({ settings });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Header] getActiveSettings failed:', err.message, err.stack);
      res.status(500).json({
        error: err.message || 'Failed to get active header settings',
      });
    }
  }

  async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data: UpdateHeaderSettingsDto = req.body;
      const updatedBy = req.user?.userId;

      const settings = await headerService.updateOrCreateSettings(data, updatedBy);
      res.json({ settings });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update header settings',
      });
    }
  }

  async deleteSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await headerService.deleteSettings(id);
      res.json({ message: 'Header settings deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete header settings',
      });
    }
  }
}

export const headerController = new HeaderController();
