import { Router } from 'express';
import { gptAssistantSettingsController } from '../controllers/gpt-assistant-settings.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN));

// Validation: only require the three visibility booleans; allow other keys (e.g. Prisma Decimal serialized as object) to pass through
const updateSettingsSchema = z.object({
  body: z
    .object({
      enabledAdmin: z.coerce.boolean(),
      enabledCustomer: z.coerce.boolean(),
      enabledGuest: z.coerce.boolean(),
    })
    .passthrough(),
});

const updatePromptSchema = z.object({
  body: z
    .object({
      prompt: z.string().min(1).optional(),
      version: z.string().optional(),
      comment: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.coerce.number().int().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required',
    }),
});

const createPromptSchema = z.object({
  body: z.object({
    type: z.string().min(1),
    prompt: z.string().min(1),
    version: z.string().optional(),
    comment: z.string().optional(),
    sortOrder: z.coerce.number().int().optional(),
  }),
});

const discoverModelsSchema = z.object({
  body: z
    .object({
      apiBaseUrl: z.string().optional(),
      providerType: z.string().optional(),
    })
    .passthrough(),
});

const testConnectionSchema = z.object({
  body: z
    .object({
      providerType: z.string().optional(),
      apiBaseUrl: z.string().optional(),
      apiKey: z.string().optional(),
      testApiKey: z.string().optional(),
      model: z.string().optional(),
      mode: z.string().optional(),
    })
    .passthrough(),
});

// Settings routes
router.get('/settings', gptAssistantSettingsController.getSettings.bind(gptAssistantSettingsController));
router.put(
  '/settings',
  validate(updateSettingsSchema),
  gptAssistantSettingsController.updateSettings.bind(gptAssistantSettingsController)
);

// Prompts routes
router.get('/prompts', gptAssistantSettingsController.getPrompts.bind(gptAssistantSettingsController));
router.get('/prompts/:id', gptAssistantSettingsController.getPrompt.bind(gptAssistantSettingsController));
router.post(
  '/prompts',
  validate(createPromptSchema),
  gptAssistantSettingsController.createPrompt.bind(gptAssistantSettingsController)
);
router.put(
  '/prompts/:id',
  validate(updatePromptSchema),
  gptAssistantSettingsController.updatePrompt.bind(gptAssistantSettingsController)
);
router.delete(
  '/prompts/:id',
  gptAssistantSettingsController.deletePrompt.bind(gptAssistantSettingsController)
);

// Analytics routes
router.get('/analytics', gptAssistantSettingsController.getAnalytics.bind(gptAssistantSettingsController));

// Logs routes
router.get('/logs', gptAssistantSettingsController.getLogs.bind(gptAssistantSettingsController));

router.post(
  '/models/discover',
  validate(discoverModelsSchema),
  gptAssistantSettingsController.discoverModels.bind(gptAssistantSettingsController)
);

// Test routes
router.post(
  '/test/connection',
  validate(testConnectionSchema),
  gptAssistantSettingsController.testConnection.bind(gptAssistantSettingsController)
);
router.post('/test/chat', gptAssistantSettingsController.testChat.bind(gptAssistantSettingsController));

export default router;
