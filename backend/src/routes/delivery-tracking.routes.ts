import { Router } from 'express';
import { deliveryTrackingController } from '../controllers/delivery-tracking.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const checkTrackingSchema = z.object({
  body: z.object({
    trackingNumber: z.string().min(1),
    carrier: z.string().optional(),
  }),
});

const testConnectionSchema = z.object({
  body: z.object({
    provider: z.string().min(1),
    apiKey: z.string().min(1),
    apiUrl: z.string().url(),
  }),
});

// All routes require authentication and admin privileges 
router.post(
  '/check',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(checkTrackingSchema),
  deliveryTrackingController.checkTracking.bind(deliveryTrackingController)
);

router.post(
  '/update/:orderId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  deliveryTrackingController.updateOrderStatus.bind(deliveryTrackingController)
);

router.post(
  '/check-all',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  deliveryTrackingController.checkAll.bind(deliveryTrackingController)
);

router.post(
  '/check-not-received',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  deliveryTrackingController.checkNotReceived.bind(deliveryTrackingController)
);

router.post(
  '/test-connection',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(testConnectionSchema),
  deliveryTrackingController.testConnection.bind(deliveryTrackingController)
);

export default router;
