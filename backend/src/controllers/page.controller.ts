import { Request, Response } from 'express';
import { pageService } from '../services/page.service';
import { CreatePageDto, UpdatePageDto } from '../types/page';

export class PageController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active === 'true';
      const pages = await pageService.getAllPages(activeOnly);
      res.json({ pages });
    } catch (error) {
      console.error('Error in pageController.getAll:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get pages';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      let statusCode = 500;
      if (errorMessage.includes('Database connection') || 
          errorMessage.includes('Database authentication') ||
          errorMessage.includes('not initialized')) {
        statusCode = 503;
      }
      
      res.status(statusCode).json({
        error: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { 
          stack: errorStack,
          hint: errorMessage.includes('migrations') 
            ? 'Run: npm run prisma:migrate' 
            : errorMessage.includes('generate')
            ? 'Run: npm run prisma:generate'
            : undefined
        }),
      });
    }
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    try {
      const slug = req.params.slug;
      const languageCode = req.query.languageCode as string | undefined;
      const page = await pageService.getPageBySlug(slug, languageCode);
      
      if (!page) {
        res.status(404).json({ error: 'Page not found' });
        return;
      }

      res.json({ page });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get page',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const page = await pageService.getPageById(id);
      
      if (!page) {
        res.status(404).json({ error: 'Page not found' });
        return;
      }

      res.json({ page });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get page',
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreatePageDto = req.body;
      const page = await pageService.createPage(data);
      res.status(201).json({ page });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create page',
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const data: UpdatePageDto = req.body;
      const page = await pageService.updatePage(id, data);
      res.json({ page });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update page',
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      await pageService.deletePage(id);
      res.json({ message: 'Page deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete page',
      });
    }
  }
}

export const pageController = new PageController();
