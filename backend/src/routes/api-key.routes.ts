import { Router } from 'express';
import { apiKeyController } from '../controllers/api-key.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// Validation schemas
const createApiKeySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    allowedIPs: z.array(z.string().ip()).optional(),
    allowedDomains: z.array(z.string().min(1)).optional(),
    scopes: z.array(z.string()).optional(),
    rateLimit: z.number().int().min(1).max(1_000_000_000).optional(),
    quota: z.number().int().min(1).optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
  }),
});

const updateApiKeySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional().nullable(),
    allowedIPs: z.array(z.string().ip()).optional(),
    allowedDomains: z.array(z.string().min(1)).optional(),
    scopes: z.array(z.string()).optional(),
    rateLimit: z.number().int().min(1).max(1_000_000_000).optional(),
    quota: z.number().int().min(1).optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

const rotateApiKeySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    allowedIPs: z.array(z.string().ip()).optional(),
    allowedDomains: z.array(z.string().min(1)).optional(),
    scopes: z.array(z.string()).optional(),
    rateLimit: z.number().int().min(1).max(1_000_000_000).optional(),
    quota: z.number().int().min(1).optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
  }),
});

// All routes require authentication
router.use(authenticate);

// Create API key
router.post(
  '/',
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createApiKeySchema),
  apiKeyController.create.bind(apiKeyController)
);

// Get all API keys
router.get('/', apiKeyController.getAll.bind(apiKeyController));

// Get available scopes (must be before /:id routes to avoid route conflicts)
router.get('/scopes', apiKeyController.getScopes.bind(apiKeyController));

// Get API key by ID
router.get('/:id', apiKeyController.getById.bind(apiKeyController));

// Update API key
router.put(
  '/:id',
  validate(updateApiKeySchema),
  apiKeyController.update.bind(apiKeyController)
);

// Delete API key
router.delete('/:id', apiKeyController.delete.bind(apiKeyController));

// Rotate API key
router.post(
  '/:id/rotate',
  validate(rotateApiKeySchema),
  apiKeyController.rotate.bind(apiKeyController)
);

// Get usage statistics
router.get('/:id/stats', apiKeyController.getStats.bind(apiKeyController));

export default router;
