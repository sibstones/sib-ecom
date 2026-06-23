import { Request, Response } from 'express';
import { alipayService } from '../services/alipay.service';
import { customerService } from '../services/customer.service';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { PaymentStatus } from '@prisma/client';
import { emailService } from '../services/email.service';
import { config } from '../config/env';
import { convertUsdToCurrencyWithOrderFxSnapshot } from '../services/order-pricing.service';
import { verifyGuestCheckoutPaymentToken } from '../utils/guest-checkout-token';

export class AlipayController {
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

      const order = await customerService.getOrder(userId, orderId);
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

      const totalUsd = Number(order.total);
      const currency = (order.checkoutCurrency || 'CNY').trim().toUpperCase();
      const total = await convertUsdToCurrencyWithOrderFxSnapshot(totalUsd, order, currency);

      const { url } = await alipayService.createPagePay(
        order.id,
        order.orderNumber,
        total,
        currency,
        `Order ${order.orderNumber}`,
        returnUrl
      );

      res.json({ url });
    } catch (error) {
      console.error('Error creating Alipay payment:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create Alipay payment',
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

      const totalUsd = Number(order.total);
      const currency = (order.checkoutCurrency || 'CNY').trim().toUpperCase();
      const total = await convertUsdToCurrencyWithOrderFxSnapshot(totalUsd, order, currency);

      const { url } = await alipayService.createPagePay(
        order.id,
        order.orderNumber,
        total,
        currency,
        `Order ${order.orderNumber}`,
        returnUrl
      );

      res.json({ url });
    } catch (error) {
      console.error('Error creating guest Alipay payment:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create Alipay payment',
      });
    }
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const postData = req.body as Record<string, string>;
      if (!postData || typeof postData !== 'object') {
        res.status(400).send('fail');
        return;
      }

      const isValid = await alipayService.verifyNotifySign(postData);
      if (!isValid) {
        res.status(400).send('fail');
        return;
      }

      const tradeStatus = postData.trade_status;
      const outTradeNo = postData.out_trade_no;

      if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
        const orderId = outTradeNo || null;

        if (orderId) {
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { user: true, promoCode: true },
          });

          if (order && order.paymentStatus !== 'PAID') {
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
              include: { promoCode: true },
            });

            if (order.promoCode?.isPartnerPromo && order.promoCode.partnerId && order.promoCode.partnerCommissionRate) {
              try {
                const { partnerCommissionService } = await import('../services/partner-commission.service');
                await partnerCommissionService.createCommission(
                  order.promoCode.partnerId,
                  order.id,
                  order.promoCode.id,
                  Number(order.total),
                  Number(order.promoCode.partnerCommissionRate)
                );
              } catch (e) {
                console.error('Failed to create partner commission:', e);
              }
            }

            if (order.user?.email) {
              try {
                await emailService.sendPaymentConfirmed(order.id, order.user.email, order.orderNumber);
              } catch (e) {
                console.error('Failed to send payment confirmation email:', e);
              }
            }
          }
        }
      }

      res.send('success');
    } catch (error) {
      console.error('Error processing Alipay webhook:', error);
      res.status(500).send('fail');
    }
  }
}

export const alipayController = new AlipayController();
