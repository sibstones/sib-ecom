import { Request, Response } from 'express';
import { cartService } from '../services/cart.service';
import { AuthRequest } from '../middleware/auth.middleware';

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'object' && v !== null && 'toNumber' in (v as object))
    return (v as { toNumber: () => number }).toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Serialize cart items so product/variant prices are plain numbers for the client. */
function serializeCartItems(items: Awaited<ReturnType<typeof cartService.getCart>>['items']) {
  return items.map((item) => ({
    ...item,
    product: item.product
      ? {
          ...item.product,
          price: toNum(item.product.price) ?? item.product.price,
          compareAtPrice: item.product.compareAtPrice != null ? toNum(item.product.compareAtPrice) ?? item.product.compareAtPrice : null,
        }
      : item.product,
    variant: item.variant
      ? { ...item.variant, price: toNum(item.variant.price) ?? item.variant.price }
      : item.variant,
  }));
}

export class CartController {
  async getCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const sessionId = req.headers['x-session-id'] as string;
      
      const cart = await cartService.getCart(userId, sessionId);
      res.json({ items: serializeCartItems(cart.items) });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get cart',
      });
    }
  }

  async addToCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('=== CONTROLLER START ===');
      console.log('req.body:', JSON.stringify(req.body, null, 2));
      console.log('req.body.size:', req.body.size);
      console.log('req.body.size type:', typeof req.body.size);
      
      const { productId, quantity = 1, variantId, size } = req.body;
      const userId = req.user?.userId;
      const sessionId = req.headers['x-session-id'] as string;

      // Debug: log what we receive
      console.log('=== CART CONTROLLER - RAW REQUEST ===');
      console.log('req.body:', JSON.stringify(req.body, null, 2));
      console.log('req.body.size:', req.body.size);
      console.log('req.body.size type:', typeof req.body.size);
      console.log('req.body.size value:', req.body.size);
      console.log('Destructured size:', size);
      console.log('Destructured size type:', typeof size);
      
      console.log('CartController.addToCart - Received:', {
        productId,
        quantity,
        variantId,
        size,
        sizeType: typeof size,
        sizeValue: size,
        sizeString: String(size),
        userId: userId || 'guest',
        sessionId: sessionId || 'none'
      });

      if (!productId) {
        res.status(400).json({ error: 'Product ID is required' });
        return;
      }

      console.log('CartController.addToCart - Calling service with:', {
        productId,
        quantity,
        variantId,
        size,
        sizeType: typeof size,
        sizeValue: size,
        userId: userId || 'guest',
        sessionId: sessionId || 'none'
      });
      
      const item = await cartService.addToCart(productId, quantity, variantId, size, userId, sessionId);
      
      console.log('CartController.addToCart - Service returned:', {
        id: item.id,
        size: item.size,
        sizeType: typeof item.size,
        fullItem: JSON.stringify(item, null, 2)
      });
      
      res.status(201).json({ item: serializeCartItems([item])[0] });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add to cart',
      });
    }
  }

  async updateQuantity(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      const { quantity } = req.body;

      if (!quantity || quantity < 0) {
        res.status(400).json({ error: 'Valid quantity is required' });
        return;
      }

      const item = await cartService.updateQuantity(itemId, quantity);
      res.json({ item: item ? serializeCartItems([item])[0] : item });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update quantity',
      });
    }
  }

  async removeFromCart(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      await cartService.removeFromCart(itemId);
      res.json({ message: 'Item removed from cart' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to remove from cart',
      });
    }
  }

  async clearCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const sessionId = req.headers['x-session-id'] as string;
      
      await cartService.clearCart(userId, sessionId);
      res.json({ message: 'Cart cleared' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to clear cart',
      });
    }
  }
}

export const cartController = new CartController();
