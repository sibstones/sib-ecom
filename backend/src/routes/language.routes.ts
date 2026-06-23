import { Router } from 'express';
import { languageController } from '../controllers/language.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const createLanguageSchema = z.object({
  body: z.object({
    code: z.string().length(2),
    name: z.string().min(1),
    nameNative: z.string().optional(),
    flag: z.string().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

const updateLanguageSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    nameNative: z.string().optional(),
    flag: z.string().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

// Public routes
router.get('/', languageController.getAll.bind(languageController));
router.get('/default', languageController.getDefault.bind(languageController));
router.get('/:id', languageController.getById.bind(languageController));

// Protected routes (Admin only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createLanguageSchema),
  languageController.create.bind(languageController)
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateLanguageSchema),
  languageController.update.bind(languageController)
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  languageController.delete.bind(languageController)
);

router.post(
  '/:id/set-default',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  languageController.setDefault.bind(languageController)
);

export default router;
