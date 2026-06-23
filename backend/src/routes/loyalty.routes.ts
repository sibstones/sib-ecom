import { Router } from 'express';
import { loyaltyController } from '../controllers/loyalty.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const spendPointsSchema = z.object({
  body: z.object({
    points: z.number().int().positive(),
    orderId: z.string().uuid().optional(),
  }),
});

// Public route (check if loyalty is enabled)
router.get(
  '/conversion',
  requireFeature('loyaltyProgramEnabled'),
  loyaltyController.getConversionRate.bind(loyaltyController)
);

// Protected routes (check if loyalty is enabled)
router.get(
  '/',
  authenticate,
  requireFeature('loyaltyProgramEnabled'),
  loyaltyController.getPoints.bind(loyaltyController)
);
router.post(
  '/spend',
  authenticate,
  requireFeature('loyaltyProgramEnabled'),
  validate(spendPointsSchema),
  loyaltyController.spendPoints.bind(loyaltyController)
);

export default router;
