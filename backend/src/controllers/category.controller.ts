import { Request, Response } from 'express';
import { categoryService } from '../services/category.service';
import { CreateCategoryDto, UpdateCategoryDto } from '../types/category';
import { AuthRequest } from '../middleware/auth.middleware';
import { setPublicStorefrontCache } from '../utils/response-cache';

export class CategoryController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const includeChildren = req.query.includeChildren === 'true';
      const flat = req.query.flat === 'true';
      const mainOnly = req.query.mainOnly === 'true';
      const languageCode = req.query.languageCode as string | undefined;
      
      const categories = flat
        ? await categoryService.getAllFlat(languageCode)
        : await categoryService.getAll(includeChildren, mainOnly, languageCode);

      setPublicStorefrontCache(res);
      res.json({ categories });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get categories',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const languageCode = req.query.languageCode as string | undefined;
      const category = await categoryService.getById(id, languageCode);
      
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }
      
      setPublicStorefrontCache(res);
      res.json({ category });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get category',
      });
    }
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const category = await categoryService.getBySlug(slug);
      
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }
      
      setPublicStorefrontCache(res);
      res.json({ category });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get category',
      });
    }
  }

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = req.body as CreateCategoryDto;
      const category = await categoryService.create(data);
      res.status(201).json({ category });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create category',
      });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateCategoryDto;
      const category = await categoryService.update(id, data);
      res.json({ category });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update category',
      });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await categoryService.delete(id);
      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete category',
      });
    }
  }
}

export const categoryController = new CategoryController();
