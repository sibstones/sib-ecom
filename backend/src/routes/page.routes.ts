import { Router } from 'express';
import { pageController } from '../controllers/page.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// Validation schemas
const createPageSchema = z.object({
  body: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    content: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    isActive: z.boolean().default(true),
  }),
});

const updatePageSchema = z.object({
  body: z.object({
    slug: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    content: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

// Public routes
router.get('/slug/:slug', pageController.getBySlug.bind(pageController));
router.get('/', pageController.getAll.bind(pageController));

// Protected routes (Admin only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createPageSchema),
  pageController.create.bind(pageController)
);

router.get(
  '/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  pageController.getById.bind(pageController)
);

router.put(
  '/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updatePageSchema),
  pageController.update.bind(pageController)
);

router.delete(
  '/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  pageController.delete.bind(pageController)
);

export default router;
