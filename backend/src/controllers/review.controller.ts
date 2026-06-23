import { Request, Response } from 'express';
import { reviewService } from '../services/review.service';
import { CreateReviewDto, UpdateReviewDto } from '../types/review';
import { AuthRequest } from '../middleware/auth.middleware';

export class ReviewController {
  async getByProduct(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await reviewService.getByProduct(productId, page, limit);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get reviews',
      });
    }
  }

  async getByUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const reviews = await reviewService.getByUser(req.user.userId);
      res.json({ reviews });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get reviews',
      });
    }
  }

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data: CreateReviewDto = req.body;
      const review = await reviewService.create(req.user.userId, data);
      res.status(201).json({ review });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create review',
      });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { reviewId } = req.params;
      const data: UpdateReviewDto = req.body;
      const review = await reviewService.update(req.user.userId, reviewId, data);
      res.json({ review });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update review',
      });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { reviewId } = req.params;
      await reviewService.delete(req.user.userId, reviewId);
      res.json({ message: 'Review deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete review',
      });
    }
  }

  async getProductStats(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const stats = await reviewService.getProductStats(productId);
      res.json({ stats });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get product stats',
      });
    }
  }
}

export const reviewController = new ReviewController();
