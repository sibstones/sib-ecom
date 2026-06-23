import { Router } from 'express';
import { countryController } from '../controllers/country.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const createCountrySchema = z.object({
  body: z.object({
    code: z.string().length(2),
    name: z.string().min(1),
    nameNative: z.string().optional(),
    currency: z.string().length(3),
    language: z.string().min(2),
    taxRate: z.number().min(0).max(1).optional(),
    shippingCost: z.number().min(0).optional(),
    freeShippingThreshold: z.number().min(0).nullable().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

const updateCountrySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    nameNative: z.string().optional(),
    currency: z.string().length(3).optional(),
    language: z.string().min(2).optional(),
    taxRate: z.number().min(0).max(1).optional(),
    shippingCost: z.number().min(0).optional(),
    freeShippingThreshold: z.number().min(0).nullable().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

// Public routes
router.get('/', countryController.getAll.bind(countryController));
router.get('/default', countryController.getDefault.bind(countryController));
router.get('/estimate', countryController.getCheckoutEstimate.bind(countryController));
router.get('/:id', countryController.getById.bind(countryController));

// Protected routes (Admin only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createCountrySchema),
  countryController.create.bind(countryController)
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateCountrySchema),
  countryController.update.bind(countryController)
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  countryController.delete.bind(countryController)
);

router.post(
  '/:id/set-default',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  countryController.setDefault.bind(countryController)
);

export default router;
