import { Router } from 'express';
import { cartController } from '../controllers/cart.controller';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// Validation schemas
const addToCartSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().default(1),
    variantId: z.string().uuid().optional(),
    size: z.string().optional(),
  }),
});

const updateQuantitySchema = z.object({
  body: z.object({
    quantity: z.number().int().positive(),
  }),
});

// Routes (authenticated or guest via session)
router.get('/', cartController.getCart.bind(cartController));
router.post(
  '/',
  validate(addToCartSchema),
  cartController.addToCart.bind(cartController)
);
router.put(
  '/:itemId',
  validate(updateQuantitySchema),
  cartController.updateQuantity.bind(cartController)
);
router.delete('/:itemId', cartController.removeFromCart.bind(cartController));
router.delete('/', cartController.clearCart.bind(cartController));

export default router;
