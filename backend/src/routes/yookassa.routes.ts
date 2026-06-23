import { Router } from 'express';
import { yookassaController } from '../controllers/yookassa.controller';
import { authenticate } from '../middleware/auth.middleware';
import { checkoutLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

// Payment creation route - require authentication
router.post(
  '/payment',
  checkoutLimiter,
  authenticate,
  yookassaController.createPayment.bind(yookassaController)
);

router.post(
  '/guest/payment',
  checkoutLimiter,
  yookassaController.createGuestPayment.bind(yookassaController)
);

// Sync payment status from YooKassa (when webhook hasn't arrived)
router.post(
  '/sync-status',
  checkoutLimiter,
  authenticate,
  yookassaController.syncPaymentStatus.bind(yookassaController)
);

router.post(
  '/guest/sync-status',
  checkoutLimiter,
  yookassaController.syncGuestPaymentStatus.bind(yookassaController)
);

// Payment status route - require authentication
router.get(
  '/payment/:paymentId',
  authenticate,
  yookassaController.getPaymentStatus.bind(yookassaController)
);

export default router;
