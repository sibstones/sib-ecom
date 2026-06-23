import { Router } from 'express';
import { guestCheckoutController } from '../controllers/guest-checkout.controller';
import { forgotPasswordLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

router.post(
  '/authenticate',
  forgotPasswordLimiter,
  guestCheckoutController.authenticate.bind(guestCheckoutController)
);

router.get(
  '/order-status',
  forgotPasswordLimiter,
  guestCheckoutController.getOrderPaymentStatus.bind(guestCheckoutController)
);

export default router;
