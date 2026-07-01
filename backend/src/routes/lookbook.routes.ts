import { Router } from 'express';
import { lookbookController } from '../controllers/lookbook.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  uploadSingleImageOrVideo,
  uploadMultipleImageOrVideo,
  handleUploadError,
} from '../middleware/upload.middleware';
import { uploadLimiter } from '../middleware/rate-limit.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// Validation schemas
const createLookbookSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    slug: z.string().optional(),
    description: z.string().optional(),
    season: z.string().optional(),
    year: z.number().int().optional(),
    isActive: z.boolean(),
  }),
});

const updateLookbookSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    slug: z.string().optional(),
    description: z.string().optional(),
    season: z.string().optional(),
    year: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

// Image upload validation (url is generated automatically)
const createImageSchema = z.object({
  body: z.object({
    lookbookId: z.string().uuid(),
    url: z.string().url().optional(),
    alt: z.string().optional(),
    order: z.union([z.string(), z.number()]).optional(),
  }),
});

const updateImageSchema = z.object({
  body: z.object({
    url: z.string().url().optional(),
    alt: z.string().optional(),
    order: z.number().int().min(0).optional(),
  }),
});

const createProductTagSchema = z.object({
  body: z.object({
    lookbookImageId: z.string().uuid(),
    productId: z.string().uuid(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
});

const reorderImagesSchema = z.object({
  body: z.object({
    imageOrders: z.array(
      z.object({
        id: z.string().uuid(),
        order: z.number().int().min(0),
      })
    ),
  }),
});

// Public routes
router.get('/', lookbookController.getAll.bind(lookbookController));
router.get('/slug/:slug', lookbookController.getBySlug.bind(lookbookController));
router.get('/:id', lookbookController.getById.bind(lookbookController));

// Protected routes (Admin only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createLookbookSchema),
  lookbookController.create.bind(lookbookController)
);

router.put(
  '/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateLookbookSchema),
  lookbookController.update.bind(lookbookController)
);

router.delete(
  '/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  lookbookController.delete.bind(lookbookController)
);

// Image management
// Upload single image
router.post(
  '/images',
  uploadLimiter,
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadSingleImageOrVideo,
  handleUploadError,
  validate(createImageSchema),
  lookbookController.addImage.bind(lookbookController)
);

// Upload multiple images
const createMultipleImagesSchema = z.object({
  body: z.object({
    lookbookId: z.string().uuid(),
  }),
});

router.post(
  '/images/multiple',
  uploadLimiter,
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadMultipleImageOrVideo,
  handleUploadError,
  validate(createMultipleImagesSchema),
  lookbookController.addMultipleImages.bind(lookbookController)
);

router.put(
  '/images/:imageId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateImageSchema),
  lookbookController.updateImage.bind(lookbookController)
);

router.delete(
  '/images/:imageId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  lookbookController.deleteImage.bind(lookbookController)
);

router.post(
  '/:lookbookId/images/reorder',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(reorderImagesSchema),
  lookbookController.reorderImages.bind(lookbookController)
);

// Product tags
router.post(
  '/images/tags',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createProductTagSchema),
  lookbookController.addProductTag.bind(lookbookController)
);

router.delete(
  '/images/tags/:tagId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  lookbookController.deleteProductTag.bind(lookbookController)
);

export default router;
