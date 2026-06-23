import { Request, Response } from 'express';
import { yookassaService } from '../services/yookassa.service';
import { customerService } from '../services/customer.service';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { PaymentStatus, OrderStatus } from '@prisma/client';
import { emailService } from '../services/email.service';
import { config } from '../config/env';
import { formatYooKassaAmountValue } from '../utils/gateway-amounts';
import { convertUsdForOrderPayment } from '../services/order-pricing.service';
import { verifyGuestCheckoutPaymentToken } from '../utils/guest-checkout-token';

export class YooKassaController {
  async createPayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { orderId } = req.body;

      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required' });
        return;
      }

      // Get order
      const order = await customerService.getOrder(userId, orderId);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Check if order is already paid
      if (order.paymentStatus === 'PAID') {
        res.status(400).json({ error: 'Order is already paid' });
        return;
      }

      // Check if payment method is GATEWAY
      if (order.paymentMethod !== 'GATEWAY') {
        res.status(400).json({ error: 'Order payment method is not GATEWAY' });
        return;
      }

      // Get user email
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user?.email) {
        res.status(400).json({ error: 'User email is required' });
        return;
      }

      const frontendBaseUrl = config.frontend.baseUrl;
      const returnUrl = `${frontendBaseUrl}/payment/success?order_id=${orderId}`;

      const checkoutCurrency = (order.checkoutCurrency || 'USD').trim().toUpperCase();
      const totalUsd = Number(order.total);
      let amountMajor: number;
      try {
        amountMajor = await convertUsdForOrderPayment(totalUsd, order);
      } catch {
        amountMajor =
          checkoutCurrency === 'RUB'
            ? Math.round((totalUsd * 80) / 10) * 10
            : totalUsd;
      }

      const amountString = formatYooKassaAmountValue(amountMajor, checkoutCurrency);

      const { paymentId, confirmationUrl } = await yookassaService.createPayment(
        order.id,
        order.orderNumber,
        amountString,
        checkoutCurrency,
        `Заказ ${order.orderNumber}`,
        returnUrl
      );

      // Store payment ID in order (can be stored in metadata or separate field)
      await prisma.order.update({
        where: { id: order.id },
        data: {
          // Store payment ID if you have a field for it
        },
      });

      res.json({ paymentId, url: confirmationUrl });
    } catch (error) {
      console.error('Error creating YooKassa payment:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create payment',
      });
    }
  }

  async createGuestPayment(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, token } = req.body as { orderId?: string; token?: string };
      if (!orderId || !token) {
        res.status(400).json({ error: 'orderId and token are required' });
        return;
      }
      const payload = verifyGuestCheckoutPaymentToken(token);
      if (!payload || payload.orderId !== orderId) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }

      const order = await customerService.getOrderForGuestCheckout(orderId, payload.email);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      if (order.paymentStatus === 'PAID') {
        res.status(400).json({ error: 'Order is already paid' });
        return;
      }
      if (order.paymentMethod !== 'GATEWAY') {
        res.status(400).json({ error: 'Order payment method is not GATEWAY' });
        return;
      }

      const frontendBaseUrl = config.frontend.baseUrl;
      const returnUrl = `${frontendBaseUrl}/payment/success?order_id=${orderId}`;

      const checkoutCurrency = (order.checkoutCurrency || 'USD').trim().toUpperCase();
      const totalUsd = Number(order.total);
      let amountMajor: number;
      try {
        amountMajor = await convertUsdForOrderPayment(totalUsd, order);
      } catch {
        amountMajor =
          checkoutCurrency === 'RUB'
            ? Math.round((totalUsd * 80) / 10) * 10
            : totalUsd;
      }

      const amountString = formatYooKassaAmountValue(amountMajor, checkoutCurrency);

      const { paymentId, confirmationUrl } = await yookassaService.createPayment(
        order.id,
        order.orderNumber,
        amountString,
        checkoutCurrency,
        `Заказ ${order.orderNumber}`,
        returnUrl
      );

      res.json({ paymentId, url: confirmationUrl });
    } catch (error) {
      console.error('Error creating guest YooKassa payment:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create payment',
      });
    }
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const rawBody = req.body;
      const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));
      const signature = req.headers['x-hmac-signature'] as string | undefined;

      const isValid = await yookassaService.verifyWebhook(bodyStr, signature);
      if (!isValid) {
        res.status(400).json({ error: 'Invalid webhook' });
        return;
      }

      let event: { type: string; object?: { metadata?: { orderId?: string } } };
      try {
        event = JSON.parse(bodyStr);
      } catch {
        res.status(400).json({ error: 'Invalid JSON' });
        return;
      }

      // Handle the event
      if (event.type === 'payment.succeeded') {
        const payment = event.object;
        const orderId = payment?.metadata?.orderId;

        if (orderId) {
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
              user: true,
              promoCode: true,
            },
          });

          if (order && order.paymentStatus !== 'PAID') {
            const updatedOrder = await prisma.order.update({
              where: { id: orderId },
              data: {
                paymentStatus: PaymentStatus.PAID,
                statusHistory: {
                  create: {
                    status: order.status,
                    notes: 'orderDetail.statusHistory.paymentReceived',
                  },
                },
              },
              include: {
                promoCode: true,
              },
            });

            // Create partner commission if order has partner promo code
            if (updatedOrder.promoCode?.isPartnerPromo && updatedOrder.promoCode.partnerId && updatedOrder.promoCode.partnerCommissionRate) {
              try {
                const { partnerCommissionService } = await import('../services/partner-commission.service');
                await partnerCommissionService.createCommission(
                  updatedOrder.promoCode.partnerId,
                  updatedOrder.id,
                  updatedOrder.promoCode.id,
                  Number(updatedOrder.total),
                  Number(updatedOrder.promoCode.partnerCommissionRate)
                );
              } catch (error) {
                console.error('Failed to create partner commission:', error);
              }
            }

            // Send payment confirmation email
            if (order?.user?.email) {
              try {
                await emailService.sendPaymentConfirmed(
                  order.id,
                  order.user.email,
                  order.orderNumber
                );
              } catch (emailError) {
                console.error('Failed to send payment confirmation email:', emailError);
              }
            }
          }
        }
      } else if (event.type === 'payment.canceled') {
        const payment = event.object;
        const orderId = payment?.metadata?.orderId;

        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: PaymentStatus.FAILED,
              statusHistory: {
                create: {
                  status: OrderStatus.PENDING,
                  notes: 'orderDetail.statusHistory.paymentFailed',
                },
              },
            },
          });
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing YooKassa webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /** Sync order payment status from YooKassa (for when webhook hasn't arrived yet). */
  async syncPaymentStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { orderId, paymentId } = req.body as { orderId?: string; paymentId?: string };
      if (!orderId || !paymentId) {
        res.status(400).json({ error: 'orderId and paymentId are required' });
        return;
      }

      const order = await customerService.getOrder(userId, orderId);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      if (order.paymentStatus === 'PAID') {
        res.json({ paid: true });
        return;
      }

      const payment = await yookassaService.getPaymentStatus(paymentId);
      if (!payment || payment.metadata?.orderId !== orderId) {
        res.json({ paid: false, status: 'unknown' });
        return;
      }

      if (payment.status === 'succeeded' && payment.paid) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.PAID,
            statusHistory: {
              create: {
                status: order.status,
                notes: 'orderDetail.statusHistory.paymentReceived',
              },
            },
          },
        });
        res.json({ paid: true, status: 'succeeded' });
      } else if (payment.status === 'canceled' || payment.status === 'cancelled' || payment.status === 'failed') {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.FAILED,
            statusHistory: {
              create: {
                status: OrderStatus.PENDING,
                notes: 'orderDetail.statusHistory.paymentFailed',
              },
            },
          },
        });
        res.json({ paid: false, status: payment.status });
      } else {
        res.json({ paid: false, status: payment.status });
      }
    } catch (error) {
      console.error('Error syncing YooKassa payment status:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to sync payment status',
      });
    }
  }

  async syncGuestPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, paymentId, token } = req.body as {
        orderId?: string;
        paymentId?: string;
        token?: string;
      };
      if (!orderId || !paymentId || !token) {
        res.status(400).json({ error: 'orderId, paymentId and token are required' });
        return;
      }
      const payload = verifyGuestCheckoutPaymentToken(token);
      if (!payload || payload.orderId !== orderId) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }

      const order = await customerService.getOrderForGuestCheckout(orderId, payload.email);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      if (order.paymentStatus === 'PAID') {
        res.json({ paid: true });
        return;
      }

      const payment = await yookassaService.getPaymentStatus(paymentId);
      if (!payment || payment.metadata?.orderId !== orderId) {
        res.json({ paid: false, status: 'unknown' });
        return;
      }

      if (payment.status === 'succeeded' && payment.paid) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.PAID,
            statusHistory: {
              create: {
                status: order.status,
                notes: 'orderDetail.statusHistory.paymentReceived',
              },
            },
          },
        });
        res.json({ paid: true, status: 'succeeded' });
      } else if (payment.status === 'canceled' || payment.status === 'cancelled' || payment.status === 'failed') {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.FAILED,
            statusHistory: {
              create: {
                status: OrderStatus.PENDING,
                notes: 'orderDetail.statusHistory.paymentFailed',
              },
            },
          },
        });
        res.json({ paid: false, status: payment.status });
      } else {
        res.json({ paid: false, status: payment.status });
      }
    } catch (error) {
      console.error('Error syncing guest YooKassa payment status:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to sync payment status',
      });
    }
  }

  async getPaymentStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        res.status(400).json({ error: 'Payment ID is required' });
        return;
      }

      const payment = await yookassaService.getPaymentStatus(paymentId);

      if (!payment) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      res.json({
        paymentId: payment.id,
        status: payment.status,
        paid: payment.paid,
        orderId: payment.metadata?.orderId,
      });
    } catch (error) {
      console.error('Error getting payment status:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get payment status',
      });
    }
  }
}

export const yookassaController = new YooKassaController();
