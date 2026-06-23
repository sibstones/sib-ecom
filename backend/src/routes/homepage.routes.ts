import { Router } from 'express';
import { homepageController } from '../controllers/homepage.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { uploadSingleImageOrVideo, handleUploadError } from '../middleware/upload.middleware';
import { uploadLimiter } from '../middleware/rate-limit.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

/** Must match Prisma `HomepageSection.type` string values and admin/homepage UI. */
const homepageSectionTypes = [
  'hero',
  'collection',
  'editorial',
  'lookbook_preview',
  'card',
  'blog',
  'audio',
  'split_triple',
  'bleed_left',
  'bleed_right',
  'center_title_media',
  'text_block',
] as const;

// Validation schemas
const createSectionSchema = z.object({
  body: z.object({
    type: z.enum(homepageSectionTypes),
    title: z.string().optional(),
    order: z.number().int().min(0),
    isActive: z.boolean(),
    config: z.record(z.unknown()).optional(),
  }),
});

const updateSectionSchema = z.object({
  body: z.object({
    type: z.enum(homepageSectionTypes).optional(),
    title: z.string().optional(),
    order: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
  }),
});

const reorderSchema = z.object({
  body: z.object({
    sectionOrders: z.array(
      z.object({
        id: z.string().uuid(),
        order: z.number().int().min(0),
      })
    ),
  }),
});

// Public routes
router.get('/', homepageController.getAll.bind(homepageController));

// Protected routes (Admin only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createSectionSchema),
  homepageController.create.bind(homepageController)
);

router.get(
  '/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  homepageController.getById.bind(homepageController)
);

router.put(
  '/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateSectionSchema),
  homepageController.update.bind(homepageController)
);

router.delete(
  '/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  homepageController.delete.bind(homepageController)
);

router.post(
  '/reorder',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(reorderSchema),
  homepageController.reorder.bind(homepageController)
);

// Upload file (image or video) for homepage sections
router.post(
  '/upload',
  uploadLimiter,
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadSingleImageOrVideo,
  handleUploadError,
  homepageController.uploadFile.bind(homepageController)
);

export default router;
