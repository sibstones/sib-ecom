import { Router, Request, Response } from 'express';
import { headerController } from '../controllers/header.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { uploadSingleImageOrVideo, handleUploadError } from '../middleware/upload.middleware';
import { uploadLimiter } from '../middleware/rate-limit.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';
import { storageService } from '../services/storage.service';

const router = Router();

const updateHeaderSettingsSchema = z.object({
  body: z.object({
    isActive: z.boolean().optional(),
    logoType: z.enum(['TEXT', 'IMAGE', 'SVG']).optional(),
    logoText: z.string().optional(),
    logoImageUrl: z.string().nullable().optional(),
    logoSvg: z.string().nullable().optional(),
    logoPosition: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional(),
    logoSize: z.string().optional(),
    logoColor: z.string().optional(),
    logoLink: z.string().optional(),
    backgroundColor: z.string().optional(),
    backgroundOpacity: z.number().int().min(0).max(100).optional(),
    backdropBlur: z.number().int().min(0).max(64).optional(),
    dropdownBackgroundOpacity: z.number().int().min(0).max(100).optional(),
    dropdownBackdropBlur: z.number().int().min(0).max(64).optional(),
    textColor: z.string().optional(),
    borderColor: z.string().optional(),
    shadowEnabled: z.boolean().optional(),
    stickyEnabled: z.boolean().optional(),
    height: z.string().optional(),
    categoryLinksEnabled: z.boolean().optional(),
    categoryLinksPosition: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional(),
    categoryLinksColor: z.string().optional(),
    categoryLinksHoverColor: z.string().optional(),
    categoryLinksActiveColor: z.string().optional(),
    categoryLinksFontSize: z.string().optional(),
    categoryLinksFontWeight: z.string().optional(),
    headerMenuDropdown: z.boolean().optional(),
    iconsEnabled: z.boolean().optional(),
    iconsPosition: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional(),
    iconsColor: z.string().optional(),
    iconsHoverColor: z.string().optional(),
    iconsSize: z.string().optional(),
    customIcons: z.array(z.object({
      name: z.string(),
      svg: z.string(),
      link: z.string(),
      visible: z.boolean(),
    })).optional(),
    categoryConditions: z.array(z.object({
      categoryId: z.string(),
      condition: z.string(),
      visible: z.boolean(),
    })).optional(),
    quickLinks: z.array(z.object({
      label: z.string(),
      link: z.string(),
      visible: z.boolean(),
    })).optional(),
  }),
});

// Public route - get active settings (for frontend)
router.get('/active', headerController.getActiveSettings.bind(headerController));

// Public route - get settings (for frontend)
router.get('/', headerController.getSettings.bind(headerController));

// Protected routes (Admin only)
router.put(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateHeaderSettingsSchema),
  headerController.updateSettings.bind(headerController)
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  headerController.deleteSettings.bind(headerController)
);

// Upload file (image) for header logo
router.post(
  '/upload',
  uploadLimiter,
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadSingleImageOrVideo,
  handleUploadError,
  async (req: Request & { file?: Express.Multer.File }, res: Response) => {
    try {
      const file = req.file;
      
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Upload file to MinIO in header folder
      const fileUrl = await storageService.uploadFile(file, 'header');

      // Return the URL
      res.status(200).json({ url: fileUrl });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to upload file',
      });
    }
  }
);

export default router;
