import { Router } from 'express';
import { alipayController } from '../controllers/alipay.controller';
import { authenticate } from '../middleware/auth.middleware';
import { checkoutLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

router.post(
  '/payment',
  checkoutLimiter,
  authenticate,
  alipayController.createPayment.bind(alipayController)
);

router.post(
  '/guest/payment',
  checkoutLimiter,
  alipayController.createGuestPayment.bind(alipayController)
);

export default router;
