import { Router } from 'express';
import { currencyRateController } from '../controllers/currency-rate.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/', currencyRateController.getAll.bind(currencyRateController));
router.get('/active', currencyRateController.getActive.bind(currencyRateController));
router.get('/convert', currencyRateController.convert.bind(currencyRateController));

// Protected: currency rate API settings and fetch (must be before /:currency)
router.get(
  '/settings',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  currencyRateController.getSettings.bind(currencyRateController)
);
router.put(
  '/settings',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  currencyRateController.updateSettings.bind(currencyRateController)
);
router.post(
  '/fetch',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  currencyRateController.fetchRates.bind(currencyRateController)
);

router.get('/:currency', currencyRateController.getRate.bind(currencyRateController));

// Protected routes (Admin only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  currencyRateController.upsert.bind(currencyRateController)
);

router.put(
  '/:currency',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  currencyRateController.update.bind(currencyRateController)
);

router.delete(
  '/:currency',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  currencyRateController.delete.bind(currencyRateController)
);

export default router;
