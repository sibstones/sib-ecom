import { Request, Response } from 'express';
import { brandService } from '../services/brand.service';
import { CreateBrandDto, UpdateBrandDto } from '../types/brand';
import { AuthRequest } from '../middleware/auth.middleware';
import { setPublicStorefrontCache } from '../utils/response-cache';

export class BrandController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const brands = await brandService.getAll();
      setPublicStorefrontCache(res);
      res.json({ brands });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get brands',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const brand = await brandService.getById(id);
      
      if (!brand) {
        res.status(404).json({ error: 'Brand not found' });
        return;
      }
      
      setPublicStorefrontCache(res);
      res.json({ brand });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get brand',
      });
    }
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const brand = await brandService.getBySlug(slug);
      
      if (!brand) {
        res.status(404).json({ error: 'Brand not found' });
        return;
      }
      
      setPublicStorefrontCache(res);
      res.json({ brand });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get brand',
      });
    }
  }

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = req.body as CreateBrandDto;
      const brand = await brandService.create(data);
      res.status(201).json({ brand });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create brand',
      });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateBrandDto;
      const brand = await brandService.update(id, data);
      res.json({ brand });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update brand',
      });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await brandService.delete(id);
      res.json({ message: 'Brand deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete brand',
      });
    }
  }
}

export const brandController = new BrandController();
