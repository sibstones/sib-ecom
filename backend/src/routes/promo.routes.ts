import { Router, Response, NextFunction } from 'express';
import { promoController } from '../controllers/promo.controller';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';
import { verifyAccessToken } from '../utils/jwt';

const router = Router();

const createPromoCodeSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    description: z.string().optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED', 'BALANCE']),
    discountValue: z.number().positive(),
    minPurchase: z.number().positive().optional(),
    maxDiscount: z.number().positive().optional(),
    usageLimit: z.number().int().positive().optional(),
    userId: z.string().uuid().optional(), // Optional: restrict to specific user
    validFrom: z.string(),
    validUntil: z.string(),
    isActive: z.boolean(),
    // Partner promo code fields
    isPartnerPromo: z.boolean().optional(),
    partnerId: z.string().uuid().optional(),
    partnerCommissionRate: z.number().min(0).max(100).optional(),
  }),
});

const applyPromoCodeSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    subtotal: z.number().nonnegative(),
  }),
});

// Public route (but can use auth token if available for user-specific promo codes)
// Apply promo code - optional authentication for user-specific promo codes
router.post(
  '/apply',
  (req: AuthRequest, _res, next) => {
    // Optional authentication - try to extract user from token if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = verifyAccessToken(token);
        req.user = payload;
      } catch (error) {
        // Token invalid or expired, continue without auth
      }
    }
    next();
  },
  validate(applyPromoCodeSchema),
  promoController.apply.bind(promoController)
);

router.get('/', promoController.getAll.bind(promoController));

// Protected routes (Admin or Partner for partner promo codes)
router.post(
  '/',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    // Allow ADMIN/SUPER_ADMIN or partners creating their own promo codes
    const body = req.body as any;
    if (body.isPartnerPromo && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      // Partners can create their own promo codes - check will be done in controller
      next();
    } else if (!body.isPartnerPromo) {
      // Only admins can create regular promo codes
      if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN') {
        next();
      } else {
        res.status(403).json({ error: 'Only admins can create regular promo codes' });
        return;
      }
    } else {
      // Admin creating partner promo code
      next();
    }
  },
  validate(createPromoCodeSchema),
  promoController.create.bind(promoController)
);

router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  promoController.getById.bind(promoController)
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  promoController.update.bind(promoController)
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  promoController.delete.bind(promoController)
);

export default router;
