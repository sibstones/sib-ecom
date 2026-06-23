import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { uploadSingleImageOrVideo, handleUploadError } from '../middleware/upload.middleware';
import { uploadLimiter } from '../middleware/rate-limit.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const updateSettingSchema = z.object({
  body: z.object({
    value: z.union([z.boolean(), z.string(), z.number(), z.record(z.unknown())]),
    description: z.string().optional(),
  }),
});

const updateMultipleSchema = z.object({
  body: z.object({
    settings: z.record(z.unknown()),
  }),
});

// Public route - get all settings (for frontend to check features)
router.get('/', settingsController.getAll.bind(settingsController));

router.post(
  '/favicon/upload',
  uploadLimiter,
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadSingleImageOrVideo,
  handleUploadError,
  settingsController.uploadSiteFavicon.bind(settingsController)
);

router.post(
  '/apple-touch-icon/upload',
  uploadLimiter,
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadSingleImageOrVideo,
  handleUploadError,
  settingsController.uploadSiteAppleTouchIcon.bind(settingsController)
);

router.get('/:key', settingsController.getSetting.bind(settingsController));

// Protected routes (Admin only)
router.put(
  '/:key',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateSettingSchema),
  settingsController.updateSetting.bind(settingsController)
);

router.put(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateMultipleSchema),
  settingsController.updateMultiple.bind(settingsController)
);

router.post(
  '/reset',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  settingsController.resetToDefaults.bind(settingsController)
);

router.post(
  '/test-email',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  settingsController.testEmail.bind(settingsController)
);

router.post(
  '/test-pinterest',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  settingsController.testPinterestConnection.bind(settingsController)
);

export default router;
