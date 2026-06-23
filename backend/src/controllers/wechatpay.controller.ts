import { Request, Response } from 'express';
import { wechatpayService } from '../services/wechatpay.service';
import { customerService } from '../services/customer.service';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { PaymentStatus } from '@prisma/client';
import { emailService } from '../services/email.service';
import { convertUsdToCurrencyWithOrderFxSnapshot } from '../services/order-pricing.service';
import { verifyGuestCheckoutPaymentToken } from '../utils/guest-checkout-token';

export class WechatpayController {
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

      const totalUsd = Number(order.total);
      let amountCny: number;
      try {
        amountCny = await convertUsdToCurrencyWithOrderFxSnapshot(totalUsd, order, 'CNY');
      } catch {
        amountCny = Math.round(totalUsd * 7.2 * 100) / 100;
      }

      const amountCents = Math.round(amountCny * 100);

      const { codeUrl } = await wechatpayService.createNativePayment(
        order.id,
        order.orderNumber,
        amountCents,
        `Order ${order.orderNumber}`
      );

      res.json({ codeUrl, orderId: order.id });
    } catch (error) {
      console.error('Error creating WeChat Pay payment:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create WeChat Pay payment',
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

      const totalUsd = Number(order.total);
      let amountCny: number;
      try {
        amountCny = await convertUsdToCurrencyWithOrderFxSnapshot(totalUsd, order, 'CNY');
      } catch {
        amountCny = Math.round(totalUsd * 7.2 * 100) / 100;
      }

      const amountCents = Math.round(amountCny * 100);

      const { codeUrl } = await wechatpayService.createNativePayment(
        order.id,
        order.orderNumber,
        amountCents,
        `Order ${order.orderNumber}`
      );

      res.json({ codeUrl, orderId: order.id });
    } catch (error) {
      console.error('Error creating guest WeChat Pay payment:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create WeChat Pay payment',
      });
    }
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const rawBody = req.body;
      const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : (typeof rawBody === 'string' ? rawBody : '');
      const signature = req.headers['wechatpay-signature'] as string;
      const serial = req.headers['wechatpay-serial'] as string;
      const nonce = req.headers['wechatpay-nonce'] as string;
      const timestamp = req.headers['wechatpay-timestamp'] as string;

      if (!signature || !serial || !nonce || !timestamp) {
        res.status(401).json({ code: 'FAIL', message: 'Missing headers' });
        return;
      }

      const isValid = await wechatpayService.verifyWebhookSignature(
        bodyStr,
        signature,
        serial,
        nonce,
        timestamp
      );

      if (!isValid) {
        res.status(401).json({ code: 'FAIL', message: 'Invalid signature' });
        return;
      }

      let event: { event_type?: string; resource?: { ciphertext?: string; nonce?: string; associated_data?: string } };
      try {
        event = JSON.parse(bodyStr);
      } catch {
        res.status(400).json({ code: 'FAIL', message: 'Invalid JSON' });
        return;
      }

      if (event.event_type === 'TRANSACTION.SUCCESS' && event.resource) {
        const decrypted = await wechatpayService.decryptNotify(event.resource);

        if (decrypted) {
          let orderId: string | null = null;
          if (decrypted.attach) {
            try {
              const attach = JSON.parse(decrypted.attach as string);
              orderId = attach?.orderId || null;
            } catch {
              //
            }
          }
          if (!orderId) {
            const outTradeNo = decrypted.out_trade_no as string;
            const match = outTradeNo?.match(/^order-(.+?)-\d+$/);
            orderId = match ? match[1] : null;
          }

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
      }

      res.json({ code: 'SUCCESS', message: 'OK' });
    } catch (error) {
      console.error('Error processing WeChat Pay webhook:', error);
      res.status(500).json({ code: 'FAIL', message: 'Webhook processing failed' });
    }
  }
}

export const wechatpayController = new WechatpayController();
