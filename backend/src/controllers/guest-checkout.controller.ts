import { Request, Response } from 'express';
import prisma from '../config/database';
import { verifyGuestCheckoutPaymentToken } from '../utils/guest-checkout-token';
import { authService } from '../services/auth.service';
import { setAuthCookies } from '../utils/auth-cookies';

/**
 * Public, token-gated order payment status for guest checkout (Stripe/YooKassa success page, WeChat poll).
 * GET /api/checkout/guest/order-status?orderId=&token=
 */
export class GuestCheckoutController {
  async authenticate(req: Request, res: Response): Promise<void> {
    try {
      const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
      const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      const result = await authService.authenticateGuestCheckout(orderId, token);

      if (result.accessToken && result.refreshToken) {
        setAuthCookies(res, result.accessToken, result.refreshToken);
      }

      res.json({ user: result.user });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to authenticate guest checkout',
      });
    }
  }

  async getOrderPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : '';
      const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
      if (!orderId || !token) {
        res.status(400).json({ error: 'orderId and token are required' });
        return;
      }
      const payload = verifyGuestCheckoutPaymentToken(token);
      if (!payload || payload.orderId !== orderId) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }

      const order = await prisma.order.findFirst({
        where: { id: orderId, user: { email: payload.email } },
        select: { paymentStatus: true, status: true, orderNumber: true },
      });

      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      res.json({
        paymentStatus: order.paymentStatus,
        status: order.status,
        orderNumber: order.orderNumber,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to load order status',
      });
    }
  }
}

export const guestCheckoutController = new GuestCheckoutController();
