import { Request, Response } from 'express';
import { footerService } from '../services/footer.service';
import { CreateFooterDto, UpdateFooterDto } from '../types/footer';

export class FooterController {
  async get(req: Request, res: Response): Promise<void> {
    try {
      const languageCode = req.query.languageCode as string | undefined;
      const footer = await footerService.getFooter(languageCode);
      res.json({ footer });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get footer',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const footer = await footerService.getFooterById(id);
      
      if (!footer) {
        res.status(404).json({ error: 'Footer not found' });
        return;
      }

      res.json({ footer });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get footer',
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateFooterDto = req.body;
      const footer = await footerService.createFooter(data);
      res.status(201).json({ footer });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create footer',
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const data: UpdateFooterDto = req.body;
      const footer = await footerService.updateFooter(id, data);
      res.json({ footer });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update footer',
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      await footerService.deleteFooter(id);
      res.json({ message: 'Footer deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete footer',
      });
    }
  }
}

export const footerController = new FooterController();
