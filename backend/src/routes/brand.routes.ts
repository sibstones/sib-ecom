import { Router } from 'express';
import { brandController } from '../controllers/brand.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const createBrandSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
    logo: z.union([z.string().url(), z.literal('')]).optional(),
  }),
});

const updateBrandSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    slug: z.string().optional(),
    logo: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  }),
});

// Public routes
router.get('/', brandController.getAll.bind(brandController));
router.get('/:id', brandController.getById.bind(brandController));
router.get('/slug/:slug', brandController.getBySlug.bind(brandController));

// Protected routes (Admin only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createBrandSchema),
  brandController.create.bind(brandController)
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateBrandSchema),
  brandController.update.bind(brandController)
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  brandController.delete.bind(brandController)
);

export default router;
