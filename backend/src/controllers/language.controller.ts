import { Request, Response } from 'express';
import { languageService } from '../services/language.service';
import { CreateLanguageDto, UpdateLanguageDto } from '../types/language';
import { AuthRequest } from '../middleware/auth.middleware';

export class LanguageController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const languages = await languageService.getAll(activeOnly);
      res.json({ languages });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get languages',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const language = await languageService.getById(id);
      if (!language) {
        res.status(404).json({ error: 'Language not found' });
        return;
      }
      res.json({ language });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get language',
      });
    }
  }

  async getDefault(req: Request, res: Response): Promise<void> {
    try {
      const language = await languageService.getDefault();
      res.json({ language });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get default language',
      });
    }
  }

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = req.body as CreateLanguageDto;
      const language = await languageService.create(data);
      res.status(201).json({ language });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create language',
      });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateLanguageDto;
      const language = await languageService.update(id, data);
      res.json({ language });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update language',
      });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await languageService.delete(id);
      res.json({ message: 'Language deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete language',
      });
    }
  }

  async setDefault(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const language = await languageService.setDefault(id);
      res.json({ language });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to set default language',
      });
    }
  }
}

export const languageController = new LanguageController();
