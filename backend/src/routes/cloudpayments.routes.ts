import { Router } from 'express';
import { cloudpaymentsController } from '../controllers/cloudpayments.controller';
import { authenticate } from '../middleware/auth.middleware';
import { checkoutLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

router.post(
  '/widget-params',
  checkoutLimiter,
  authenticate,
  cloudpaymentsController.getWidgetParams.bind(cloudpaymentsController)
);

router.post(
  '/guest/widget-params',
  checkoutLimiter,
  cloudpaymentsController.getGuestWidgetParams.bind(cloudpaymentsController)
);

export default router;
