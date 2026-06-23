import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const createReviewSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    orderId: z.string().uuid().optional(),
    rating: z.number().int().min(1).max(5),
    title: z.string().optional(),
    comment: z.string().optional(),
  }),
});

// Public routes (check if reviews are enabled)
router.get(
  '/product/:productId',
  requireFeature('reviewsEnabled'),
  reviewController.getByProduct.bind(reviewController)
);
router.get(
  '/product/:productId/stats',
  requireFeature('reviewsEnabled'),
  reviewController.getProductStats.bind(reviewController)
);

// Protected routes (check if reviews are enabled)
router.get(
  '/user',
  authenticate,
  requireFeature('reviewsEnabled'),
  reviewController.getByUser.bind(reviewController)
);

router.post(
  '/',
  authenticate,
  requireFeature('reviewsEnabled'),
  validate(createReviewSchema),
  reviewController.create.bind(reviewController)
);

router.put(
  '/:reviewId',
  authenticate,
  reviewController.update.bind(reviewController)
);

router.delete(
  '/:reviewId',
  authenticate,
  reviewController.delete.bind(reviewController)
);

export default router;
