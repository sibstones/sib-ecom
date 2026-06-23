import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
    description: z.string().optional(),
    parentId: z.string().uuid().optional(),
    isMain: z.boolean().optional(),
  }),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    slug: z.string().optional(),
    description: z.string().optional(),
    parentId: z.string().uuid().nullable().optional(),
    isMain: z.boolean().optional(),
  }),
});

// Public routes
router.get('/', categoryController.getAll.bind(categoryController));
router.get('/:id', categoryController.getById.bind(categoryController));
router.get('/slug/:slug', categoryController.getBySlug.bind(categoryController));

// Protected routes (Admin only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createCategorySchema),
  categoryController.create.bind(categoryController)
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateCategorySchema),
  categoryController.update.bind(categoryController)
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  categoryController.delete.bind(categoryController)
);

export default router;
