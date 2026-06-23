import { Router } from 'express';
import { wechatpayController } from '../controllers/wechatpay.controller';
import { authenticate } from '../middleware/auth.middleware';
import { checkoutLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

router.post(
  '/payment',
  checkoutLimiter,
  authenticate,
  wechatpayController.createPayment.bind(wechatpayController)
);

router.post(
  '/guest/payment',
  checkoutLimiter,
  wechatpayController.createGuestPayment.bind(wechatpayController)
);

export default router;
