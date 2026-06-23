import { Request, Response } from 'express';
import { homepageService } from '../services/homepage.service';
import { CreateHomepageSectionDto, UpdateHomepageSectionDto } from '../types/homepage';
import { storageService } from '../services/storage.service';
import { setPublicStorefrontCache } from '../utils/response-cache';

export class HomepageController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active === 'true';
      const languageCode = req.query.languageCode as string | undefined;
      const sections = await homepageService.getAllSections(activeOnly, languageCode);
      if (activeOnly) {
        setPublicStorefrontCache(res);
      }
      res.json({ sections });
    } catch (error) {
      console.error('Error in homepageController.getAll:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get sections';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Determine status code based on error type
      let statusCode = 500;
      if (errorMessage.includes('Database connection') || 
          errorMessage.includes('Database authentication') ||
          errorMessage.includes('not initialized')) {
        statusCode = 503; // Service Unavailable
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

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const section = await homepageService.getSectionById(id);
      
      if (!section) {
        res.status(404).json({ error: 'Section not found' });
        return;
      }

      res.json({ section });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get section',
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateHomepageSectionDto = req.body;
      const section = await homepageService.createSection(data);
      res.status(201).json({ section });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create section',
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const data: UpdateHomepageSectionDto = req.body;
      const section = await homepageService.updateSection(id, data);
      res.json({ section });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update section',
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      await homepageService.deleteSection(id);
      res.json({ message: 'Section deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete section',
      });
    }
  }

  async reorder(req: Request, res: Response): Promise<void> {
    try {
      const { sectionOrders } = req.body as { sectionOrders: { id: string; order: number }[] };
      await homepageService.reorderSections(sectionOrders);
      res.json({ message: 'Sections reordered successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to reorder sections',
      });
    }
  }

  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file as Express.Multer.File;
      
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Upload file to MinIO in homepage folder
      const fileUrl = await storageService.uploadFile(file, 'homepage');

      // Return the URL
      res.status(200).json({ url: fileUrl });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to upload file',
      });
    }
  }
}

export const homepageController = new HomepageController();
