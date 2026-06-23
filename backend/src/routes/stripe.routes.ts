import { Router } from 'express';
import { stripeController } from '../controllers/stripe.controller';
import { authenticate } from '../middleware/auth.middleware';
import { checkoutLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

// Checkout session routes - require authentication
// Note: Webhook route is handled directly in server.ts before body parsing middleware
router.post(
  '/checkout',
  checkoutLimiter,
  authenticate,
  stripeController.createCheckoutSession.bind(stripeController)
);

router.get(
  '/session/:sessionId',
  authenticate,
  stripeController.getSessionStatus.bind(stripeController)
);

// Guest checkout (token + orderId in body; no auth cookies)
router.post(
  '/guest/checkout',
  checkoutLimiter,
  stripeController.createGuestCheckoutSession.bind(stripeController)
);

router.get(
  '/guest/session/:sessionId',
  checkoutLimiter,
  stripeController.getGuestSessionStatus.bind(stripeController)
);

export default router;
