import { Router } from 'express';
import { paymentGatewayController } from '../controllers/payment-gateway.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const createGatewaySchema = z.object({
  body: z.object({
    type: z.string().min(1),
    name: z.string().min(1),
    isEnabled: z.boolean().optional(),
    isTestMode: z.boolean().optional(),
    config: z.record(z.unknown()),
    supportedCountries: z.array(z.string()).optional(),
    supportedCurrencies: z.array(z.string()).optional(),
    sortOrder: z.number().int().optional(),
  }),
});

const updateGatewaySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    isEnabled: z.boolean().optional(),
    isTestMode: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
    supportedCountries: z.array(z.string()).optional(),
    supportedCurrencies: z.array(z.string()).optional(),
    sortOrder: z.number().int().optional(),
  }),
});

// Public routes
router.get('/', paymentGatewayController.getAll.bind(paymentGatewayController));
router.get('/checkout', paymentGatewayController.getForCheckout.bind(paymentGatewayController));
router.get('/:id', paymentGatewayController.getById.bind(paymentGatewayController));

// Protected routes (Admin only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createGatewaySchema),
  paymentGatewayController.create.bind(paymentGatewayController)
);

// test-connection MUST be before /:id routes to avoid "test-connection" matching as :id
router.post(
  '/test-connection',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(
    z.object({
      body: z.object({
        type: z.string().min(1),
        config: z.record(z.unknown()),
      }),
    })
  ),
  paymentGatewayController.testConnection.bind(paymentGatewayController)
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateGatewaySchema),
  paymentGatewayController.update.bind(paymentGatewayController)
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  paymentGatewayController.delete.bind(paymentGatewayController)
);

router.post(
  '/:id/toggle',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(z.object({ body: z.object({ enabled: z.boolean() }) })),
  paymentGatewayController.toggleEnabled.bind(paymentGatewayController)
);

export default router;
